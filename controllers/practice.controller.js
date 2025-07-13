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
  const userId = req.query.user_id;
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
