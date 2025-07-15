module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Song", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    artist: { type: DataTypes.STRING },
    genre: { type: DataTypes.STRING },
    coverUrl: { type: DataTypes.STRING }, // 앨범 커버 이미지 URL
    noteSheetUrl: { type: DataTypes.STRING }, // 오선보 이미지 URL  
    tabSheetUrl: { type: DataTypes.STRING }, // TAB 악보 이미지 URL
    sheetUrl: { type: DataTypes.STRING }, // 기존 호환성을 위해 유지 (deprecated)
  });
};
