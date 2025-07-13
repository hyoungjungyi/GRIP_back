const { Song, PracticeRecord , SavedSong} = require('../models');
const {Op, Sequelize} = require('sequelize');

//ai 생성하기
exports.generateTabFromAudio = async (req, res) => {
  const { audio_url } = req.body;
  

  if (!audio_url) {
    return res.status(400).json({ message: 'audio_url이 필요합니다.' });
  }

  try {
    // 실제로는 AI 모델 호출 or S3 업로드 처리할 부분
    // 여기선 임시로 악보 이미지 URL 생성
    const fakeTabUrl = `https://your-bucket.s3.amazonaws.com/generated_tab_${Date.now()}.png`;

    // DB에 노래 정보 저장 (AI 생성된 노래는 임시값 입력)
    const newSong = await Song.create({
      title: 'Untitled',
      artist: 'Unknown',
      genre: 'AI',
      tabImageUrl: fakeTabUrl,
    });

    return res.status(200).json({
      success: true,
      message: '악보 생성 완료',
      tab_image_url: fakeTabUrl,
      song_id: newSong.id,
    });
  } catch (error) {
    console.error('악보 생성 오류:', error);
    return res.status(500).json({ message: '서버 에러' });
  }
};


//노래 띄우기
exports.getAllSongLists = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(400).json({ message: 'user_id가 필요합니다' });
  }

  try {
    // 1. ongoing: 사용자가 연습한 곡 리스트 + 진행률
    const ongoingRecords = await PracticeRecord.findAll({
      where: { userId },
      include: [{ model: Song }],
    });

    const ongoing = ongoingRecords.map(record => ({
      song_id: record.songId,
      title: record.Song?.title || 'Unknown',
      artist: record.Song?.artist || 'Unknown',
      progress: Math.min(100, Math.floor((record.totalPracticeTime || 0) / 1800 * 100)), // 30분 기준
    }));

    // 2. recommend: 사용자가 연습하지 않은 곡 중 랜덤 추천
    const practicedSongIds = await PracticeRecord.findAll({
      where: { userId },
      attributes: ['songId'],
      raw: true
    }).then(records => records.map(r => r.songId));

    const recommendSongs = await Song.findAll({
      where: {
        id: { [Op.notIn]: practicedSongIds },
        genre: { [Op.not]: 'AI' }
      },
      order: Sequelize.literal('RAND()'), // 무작위 정렬 (MySQL용)
      limit: 3
    });

    const recommend = recommendSongs.map(song => ({
      song_id: song.id,
      title: song.title,
      artist: song.artist,
      genre: song.genre
    }));

    // 3. generated: genre === 'AI'인 곡
    const generatedSongs = await Song.findAll({
      where: {
        genre: 'AI'
      },
      order: [['createdAt', 'DESC']],
    });

    const generated = generatedSongs.map(song => ({
      song_id: song.id,
      title: song.title,
      created_at: song.createdAt,
    }));

    return res.status(200).json({ ongoing, recommend, generated });

  } catch (error) {
    console.error('🎸 노래 리스트 불러오기 오류:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
};

//악보 띄우기
exports.getSheetImage = async (req, res) => {
  const sheetId = req.params.id;

  if (!sheetId) {
    return res.status(400).json({ message: '악보 ID가 필요합니다.' });
  }

  try {
    const song = await Song.findByPk(sheetId);

    if (!song) {
      return res.status(404).json({ message: '해당 악보를 찾을 수 없습니다.' });
    }

    // 악보 이미지 URL 반환
    return res.status(200).json({
      sheet_image_url: song.tabImageUrl // 컬럼 이름 확인 필요
    });
  } catch (error) {
    console.error('악보 조회 오류:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
};
