module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Song", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    artist: { type: DataTypes.STRING },
    genre: { type: DataTypes.STRING },
    sheetUrl: { type: DataTypes.STRING }, // 악보 이미지 url
  });
};
