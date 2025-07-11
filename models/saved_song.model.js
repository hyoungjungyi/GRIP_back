module.exports = (sequelize, DataTypes) => {
  return sequelize.define("SavedSong", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    songId: { type: DataTypes.INTEGER, allowNull: false },
    savedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  });
};
