module.exports = (sequelize, DataTypes) => {
  return sequelize.define("File", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    practiceRecordId: { type: DataTypes.INTEGER },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    songTitle: { type: DataTypes.STRING },
    videoUrl: { type: DataTypes.STRING },
    audioUrl: { type: DataTypes.STRING },
    recordedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  });
};
