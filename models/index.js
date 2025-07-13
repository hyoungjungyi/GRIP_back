const Sequelize = require('sequelize');
const sequelize = require('../config/db.js'); // Sequelize 연결 설정한 곳

const User = require('./user.model')(sequelize, Sequelize.DataTypes);
const SavedSong = require('./saved_song.model')(sequelize, Sequelize.DataTypes);
const PracticeRecord = require('./practice_record.model')(sequelize, Sequelize.DataTypes);
const ChromaticPractice = require('./chromatic_practice.model')(sequelize, Sequelize.DataTypes);
const File = require('./file.model')(sequelize, Sequelize.DataTypes);
const Song = require('./song.model')(sequelize, Sequelize.DataTypes);


User.hasMany(SavedSong, { foreignKey: "userId" });
SavedSong.belongsTo(User, { foreignKey: "userId" });

User.hasMany(PracticeRecord, { foreignKey: "userId" });
User.hasMany(ChromaticPractice, { foreignKey: "userId" });
User.hasMany(File, { foreignKey: "userId" });

Song.hasMany(SavedSong, { foreignKey: "songId" });
SavedSong.belongsTo(Song, { foreignKey: "songId" });

PracticeRecord.hasMany(File, { foreignKey: "practiceRecordId" });
PracticeRecord.belongsTo(models.Song, {foreignKey:'songId'});
Song.hasMany(models.PracticeRecord,{foreignKey:'songId'});

module.exports = {
  sequelize,
  User,
  SavedSong,
  PracticeRecord,
  ChromaticPractice,
  File,
  Song,
};