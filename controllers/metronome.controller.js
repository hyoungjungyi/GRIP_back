const { ChromaticPractice } = require('../models');




//바로 직전 프리셋 반환
exports.getLastChromaticPractice = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(400).json({ message: 'user_id 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const lastRecord = await ChromaticPractice.findOne({
      where: { userId : userId },
      order: [['date', 'DESC']],
    });

    if (!lastRecord) {
      return res.status(404).json({ message: '해당 유저의 기록이 없습니다.' });
    }

    res.status(200).json({
      bpm: lastRecord.bpm,
      preset: lastRecord.fingering,
      last_used: lastRecord.date,
    });
  } catch (error) {
    console.error('DB 조회 오류:', error);
    res.status(500).json({ message: '서버 에러' });
  }
};


//크로매틱 연습 기록 db에 저장
exports.saveTotalPracticeTime = async (req, res) => {

  const { date, totalPracticeTime, details } = req.body;
  const userId = req.user.id;

  if (!userId || !date || totalPracticeTime == null || !Array.isArray(details)) {
    return res.status(400).json({ message: 'userId, date, totalPracticeTime, details(배열) 모두 필요합니다.' });
  }

  try {
    // 운지법별로 가장 마지막 항목만 저장
    const latestByFingering = {};
    for (const entry of details) {
      latestByFingering[entry.fingering] = entry; // 덮어쓰기 → 마지막 항목 유지
    }
    console.log("1");

    // 운지법별로 DB에 upsert (update or insert)
    for (const fingering in latestByFingering) {
      const record = latestByFingering[fingering];

      // upsert는 find 후 update or create로 대체 가능
      const existing = await ChromaticPractice.findOne({
        where: { userId, date, fingering }
      });
      console.log("2");

      if (existing) {
        await existing.update({
          practiceTime: record.practiceTime,
          bpm: record.bpm,
        });
      } else {
        await ChromaticPractice.create({
          userId,
          date,
          fingering,
          practiceTime: record.practiceTime,
          bpm: record.bpm,
        });
        console.log("3");
      }
    }

    return res.status(200).json({
      success: true,
      message: '오늘 크로매틱 연습 총량 저장 완료',
      data: { userId, date, totalPracticeTime },
    });
  } catch (error) {
    console.error('DB 저장 오류:', error);
    console.error('❌ 전체 오류:', error);
    return res.status(500).json({ message: '서버 에러',error: error.message, });
  }
};















//테스트용
//routes/song.js
const { SavedSong, Song } = require('../models');

exports.getAllSavedSongs = async (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ message: 'user_id is required' });
  }

  try {
    const savedSongs = await SavedSong.findAll({
      where: { userId },
      include: [
        {
          model: Song,
          attributes: ['id', 'title', 'artist', 'genre', 'imageUrl']  // 필요한 필드만 선택
        }
      ],
      order: [['createdAt', 'DESC']],
    });

    const songList = savedSongs.map(entry => ({
      savedId: entry.id,
      savedAt: entry.createdAt,
      ...entry.Song.dataValues
    }));

    res.json(songList);
  } catch (error) {
    console.error('🎸 [GET /songs/all-lists] Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
