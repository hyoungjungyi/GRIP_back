const { PracticeRecord, File, ChromaticPractice, User } = require('../models');
const { Op } = require('sequelize');

//연습기록 삭제 
exports.deleteChromaticPractice = async (req, res) => {
  const id = req.params.id; // URL 파라미터에서 삭제할 id 추출


  if (!id) {
    return res.status(400).json({ message: '삭제할 항목 ID가 필요합니다.' });
  }

  try {
    const record = await ChromaticPractice.findByPk(id);

    if (!record) {
      return res.status(404).json({ message: '삭제할 항목을 찾을 수 없습니다.' });
    }

    await record.destroy();

    res.status(200).json({
      success: true,
      message: '크로매틱 연습 항목이 삭제되었습니다',
      deletedId: id
    });
  } catch (error) {
    console.error('삭제 중 오류:', error);
    res.status(500).json({ message: '서버 에러' });
  }
};




//오늘 연습량 불러오기
exports.getTodayPractice = async (req, res) => {
  const userId = req.query.user_id;

  if (!userId) return res.status(400).json({ message: 'user_id가 필요합니다.' });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // 1. 오늘 전체 연습 기록
    const practiceRecord = await PracticeRecord.findOne({
      where: { userId, date: today },
    });

    // 2. 오늘 녹음파일 존재 여부 (audioUrl 체크)
    const recording = await File.findOne({
      where: {
        userId,
        recordedAt: {
          [Op.gte]: today + ' 00:00:00',
          [Op.lte]: today + ' 23:59:59',
        },
        audioUrl: { [Op.ne]: null },
      },
    });

    // 3. 오늘 크로매틱 연습 기록 조회
    const chromaticPractices = await ChromaticPractice.findAll({
      where: { userId, date: today },
    });

    const totalChromaticDuration = chromaticPractices.reduce(
      (acc, cur) => acc + (cur.practiceTime || 0),
      0
    );

    const fingerings = [...new Set(chromaticPractices.map((p) => p.fingering).filter(Boolean))];
    const bpms = [...new Set(chromaticPractices.map((p) => p.bpm).filter(Boolean))];

    // 4. 유저 목표 연습 시간
    const user = await User.findByPk(userId);

    res.status(200).json({
      date: today,
      total_time: practiceRecord ? practiceRecord.totalPracticeTime : 0,
      daily_goal_time: user ? user.goalTime || 0 : 0,
      recording_uploaded: Boolean(recording),
      chromatic_practice: {
        total_duration: totalChromaticDuration,
        fingering: fingerings,
        bpms: bpms,
      },
    });
  } catch (error) {
    console.error('오늘 연습량 불러오기 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};


//날짜별 연습 기록 불러옴 
exports.getPracticeHistoryByDate = async (req, res) => {
  const userId = req.user?.id;
  const date = req.query.date;

  if (!userId || !date) {
    return res.status(400).json({ message: 'user_id와 date가 필요합니다.' });
  }

  try {
    // 1. 연습 기록
    const practiceRecord = await PracticeRecord.findOne({
      where: { userId, date },
    });

    // 2. 녹음 파일 (파일이 여러개일 수도 있는데, 일단 최신 하나만)
    const recordingFile = await File.findOne({
      where: {
        userId,
        recordedAt: {
          [Op.gte]: date + ' 00:00:00',
          [Op.lte]: date + ' 23:59:59',
        },
        audioUrl: { [Op.ne]: null },
      },
      order: [['recordedAt', 'DESC']],
    });

    // 3. 크로매틱 연습 기록
    const chromaticPractices = await ChromaticPractice.findAll({
      where: { userId, date },
    });

    // 4. 응답 데이터 구성
    const chromatic = chromaticPractices.map((p) => ({
      fingering: p.fingering,
      bpm: p.bpm,
      duration: p.practiceTime,
    }));

    res.status(200).json({
      date,
      total_time: practiceRecord ? practiceRecord.totalPracticeTime : 0,
      achieved: practiceRecord ? practiceRecord.isAchieved === 'yes' : false,
      recording_url: recordingFile ? recordingFile.audioUrl : null,
      chromatic,
    });
  } catch (error) {
    console.error('연습 히스토리 조회 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

//연습 목표 설정하기
exports.getUserGoalInfo = async (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ message: 'user_id가 필요합니다.' });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    // 유저 정보
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: '유저를 찾을 수 없습니다.' });

    // 녹음 파일 존재 여부
    const hasRecording = await File.findOne({
      where: {
        userId,
        audioUrl: { [Op.ne]: null },
        recordedAt: {
          [Op.gte]: `${today} 00:00:00`,
          [Op.lte]: `${today} 23:59:59`,
        }
      }
    });

    // 크로매틱 연습 여부
    const hasChromatic = await ChromaticPractice.findOne({
      where: { userId, date: today }
    });

    res.status(200).json({
      daily_goal_time: user.goalTime || 0,
      has_recording_today: Boolean(hasRecording),
      has_chromatic_today: Boolean(hasChromatic),
    });
  } catch (error) {
    console.error('🎯 목표 설정 조회 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

// 하루 달성 체크 및 업데이트
exports.checkDailyAchievement = async (req, res) => {
  const { user_id, date } = req.body;
  if (!user_id || !date) return res.status(400).json({ message: 'user_id와 date가 필요합니다.' });

  try {
    const user = await User.findByPk(user_id);
    const goal = user?.goalTime || 0;

    const record = await PracticeRecord.findOne({ where: { userId: user_id, date } });
    const totalTime = record?.totalPracticeTime || 0;

    const recording = await File.findOne({
      where: {
        userId: user_id,
        recordedAt: { [Op.between]: [`${date} 00:00:00`, `${date} 23:59:59`] },
        audioUrl: { [Op.ne]: null },
      },
    });

    const chromatic = await ChromaticPractice.findOne({ where: { userId: user_id, date } });

    const achieved = totalTime >= goal && recording && chromatic ? 'yes' : 'no';

    if (record) {
      record.isAchieved = achieved;
      await record.save();
    } else {
      await PracticeRecord.create({ userId: user_id, date, totalPracticeTime: 0, isAchieved: achieved });
    }

    return res.status(200).json({ date, isAchieved: achieved });
  } catch (err) {
    console.error('달성 판단 오류:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
};

// 월별 연습 상태 조회 (프론트엔드 호환)
exports.getMonthlyStatus = async (req, res) => {
  const { year, month } = req.query;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: '인증이 필요합니다.' });
  }

  if (!year || !month) {
    return res.status(400).json({ message: 'year, month가 필요합니다.' });
  }

  try {
    // 해당 월의 일수 계산
    const daysInMonth = new Date(year, month, 0).getDate();
    const daily_status = new Array(daysInMonth).fill(null);

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const records = await PracticeRecord.findAll({
      where: {
        userId: userId,
        date: { [Op.between]: [start, end] },
      },
    });

    // 각 날짜별로 상태 설정
    records.forEach(record => {
      const day = parseInt(record.date.split('-')[2]) - 1; // 0-based index
      if (record.isAchieved === 'yes') {
        daily_status[day] = 'success';
      } else if (record.isAchieved === 'no') {
        daily_status[day] = 'failure';
      }
    });

    return res.status(200).json({
      year: parseInt(year),
      month: parseInt(month),
      daily_status
    });
  } catch (err) {
    console.error('월별 상태 조회 오류:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
};

// 월별 성공/실패 날짜 반환
exports.getMonthlyAchievements = async (req, res) => {
  const { user_id, year, month } = req.query;
  if (!user_id || !year || !month) return res.status(400).json({ message: 'user_id, year, month가 필요합니다.' });

  const start = `${year}-${month}-01`;
  const end = `${year}-${month}-31`;

  try {
    const records = await PracticeRecord.findAll({
      where: {
        userId: user_id,
        date: { [Op.between]: [start, end] },
      },
    });

    const success_dates = records.filter(r => r.isAchieved === 'yes').map(r => r.date);
    const fail_dates = records.filter(r => r.isAchieved === 'no').map(r => r.date);

    return res.status(200).json({ success_dates, fail_dates });
  } catch (err) {
    console.error('월별 달성 조회 오류:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
};

//목표 연습량 저장(Post)
exports.setPracticeGoal = async (req, res) => {
  const userId = req.user?.id;
  const { goal_time, use_chromatic, require_recording } = req.body;

  try {
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({ message: "유저를 찾을 수 없습니다." });
    }

    user.goal_time = goal_time;
    user.use_chromatic = use_chromatic;
    user.require_recording = require_recording;

    await user.save();

    return res.status(200).json({ message: "연습 목표 설정 완료" });
  } catch (err) {
    console.error("연습 목표 설정 실패:", err);
    return res.status(500).json({ message: "서버 에러" });
  }
};
