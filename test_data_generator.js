const { PracticeRecord, User, ChromaticPractice } = require('./models');

async function generateTestData() {
  try {
    console.log('🎯 테스트 데이터 생성 시작...');

    // 테스트 사용자 생성 (userId = 1)
    const [user, created] = await User.findOrCreate({
      where: { id: 1 },
      defaults: {
        username: 'testuser',
        googleId: 'test_google_id_123',
        email: 'test@example.com',
        goalTime: 60, // 하루 60분 목표
        chromaticEnabled: true,
        recordingEnabled: true
      }
    });

    if (created) {
      console.log('✅ 테스트 사용자 생성됨:', user.username);
    } else {
      console.log('✅ 기존 테스트 사용자 사용:', user.username);
    }

    // 5월, 6월, 7월 데이터 생성
    const months = [
      { year: 2025, month: 5, days: 31 },
      { year: 2025, month: 6, days: 30 },
      { year: 2025, month: 7, days: 31 }
    ];

    for (const { year, month, days } of months) {
      console.log(`\n📅 ${year}년 ${month}월 데이터 생성 중...`);

      for (let day = 1; day <= days; day++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // 80% 확률로 연습 기록 생성
        if (Math.random() < 0.8) {
          // 랜덤 연습 시간 (30~120분)
          const practiceTime = Math.floor(Math.random() * 90) + 30;
          
          // 목표 시간(60분) 달성 여부
          const achieved = practiceTime >= 60 ? 'yes' : 'no';

          // PracticeRecord 생성
          await PracticeRecord.findOrCreate({
            where: { userId: 1, date },
            defaults: {
              userId: 1,
              date,
              totalPracticeTime: practiceTime,
              isAchieved: achieved
            }
          });

          // 50% 확률로 크로매틱 연습 추가
          if (Math.random() < 0.5) {
            const fingerings = ['1-2-3-4', '4-3-2-1', '1-3-2-4', '2-1-4-3'];
            const randomFingering = fingerings[Math.floor(Math.random() * fingerings.length)];
            const randomBpm = Math.floor(Math.random() * 40) + 60; // 60~100 BPM
            const chromaticTime = Math.floor(Math.random() * 20) + 5; // 5~25분

            await ChromaticPractice.findOrCreate({
              where: { userId: 1, date },
              defaults: {
                userId: 1,
                date,
                fingering: randomFingering,
                bpm: randomBpm,
                practiceTime: chromaticTime
              }
            });
          }

          console.log(`  ${date}: ${practiceTime}분 연습 (${achieved === 'yes' ? '달성' : '미달성'})`);
        }
      }
    }

    console.log('\n🎉 테스트 데이터 생성 완료!');
    
    // 생성된 데이터 통계
    const totalRecords = await PracticeRecord.count({ where: { userId: 1 } });
    const achievedRecords = await PracticeRecord.count({ 
      where: { userId: 1, isAchieved: 'yes' } 
    });
    const chromaticRecords = await ChromaticPractice.count({ where: { userId: 1 } });

    console.log(`\n📊 생성된 데이터 통계:`);
    console.log(`  - 총 연습 기록: ${totalRecords}개`);
    console.log(`  - 목표 달성: ${achievedRecords}개`);
    console.log(`  - 크로매틱 연습: ${chromaticRecords}개`);
    
  } catch (error) {
    console.error('❌ 테스트 데이터 생성 실패:', error);
  }
}

// 스크립트 실행
generateTestData().then(() => {
  console.log('✅ 스크립트 완료');
  process.exit(0);
}).catch(error => {
  console.error('❌ 스크립트 실행 실패:', error);
  process.exit(1);
});
