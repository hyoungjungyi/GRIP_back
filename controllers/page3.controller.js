const { PracticeRecord, File, ChromaticPractice, User } = require('../models');
const { Op } = require('sequelize');

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

//영상만 다 불러오기
exports.getVideoFiles = async (req, res) => {
  const userId = req.query.user_id;

  if (!userId) return res.status(400).json({ message: 'user_id가 필요합니다.' });

  try {
    const videos = await File.findAll({
      where: {
        userId,
        videoUrl: { [Op.ne]: null },  // videoUrl 컬럼이 null이 아닌 것만
      },
      order: [['recordedAt', 'DESC']],
      attributes: ['videoUrl', 'songTitle', 'recordedAt'],
    });

    const response = videos.map((v) => ({
      video_url: v.videoUrl,
      song_title: v.songTitle,
      date: v.recordedAt.toISOString().slice(0, 10),
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error('영상 파일 조회 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

//노래별로 영상과 녹음 다 불러오기
exports.getFilesBySong = async (req, res) => {
  const userId = req.query.user_id;
  const songId = req.query.song_id;

  if (!userId || !songId) {
    return res.status(400).json({ message: 'user_id와 song_id가 필요합니다.' });
  }

  try {
    const files = await File.findAll({
      where: {
        userId,
        songTitle: { [Op.ne]: null }, // songTitle이 null 아닌 것 (안하면 아무거나 나올 수도 있음)
      },
      // songTitle 대신 song_id가 DB에 없으면 songTitle로 필터링 못함. 실제 DB 구조에 맞게 조정 필요
      // songId 필드 없으면, songTitle로 필터하는 대신 songId 컬럼 추가 검토 필요

      // 아래 조건은 songTitle 대신 songId가 있으면 대체 가능:
      // where: { userId, songId },

      // 만약 song_id 컬럼 있으면 아래로 변경:
      // where: { userId, songId: songId },

      order: [['recordedAt', 'DESC']],
      attributes: ['videoUrl', 'audioUrl', 'recordedAt'],
    });

    // songTitle이 없으면 요청한 song_id랑 매칭 안 될 수 있음. DB 스키마 확인 필요

    // 응답 변환
    const response = files.map((f) => ({
      video_url: f.videoUrl || null,
      recording_url: f.audioUrl || null,
      date: f.recordedAt.toISOString().slice(0, 10),
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error('노래별 파일 조회 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};
