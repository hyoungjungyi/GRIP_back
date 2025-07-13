const { PracticeRecord, File, ChromaticPractice, User } = require('../models');
const { Op } = require('sequelize');

//영상만 다 불러오기
exports.getVideoFiles = async (req, res) => {
    const userId = req.user?.id;

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
  const userId = req.user?.id;
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