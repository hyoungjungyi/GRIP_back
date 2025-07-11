module.exports = (sequelize, DataTypes) => {
  return sequelize.define("PracticeRecord", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    totalPracticeTime: { type: DataTypes.INTEGER, defaultValue: 0 }, // 분 단위
    isAchieved: {
      type: DataTypes.ENUM("yes", "no"),
      defaultValue: "no",
    },
  });
};
