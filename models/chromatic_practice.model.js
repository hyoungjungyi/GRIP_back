module.exports = (sequelize, DataTypes) => {
  return sequelize.define("ChromaticPractice", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    fingering: { type: DataTypes.STRING }, // 운지법 이름
    bpm: { type: DataTypes.INTEGER },
    practiceTime: { type: DataTypes.INTEGER }, // 분 단위
  });
};
