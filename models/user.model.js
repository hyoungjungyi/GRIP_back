module.exports = (sequelize, DataTypes) => {
  return sequelize.define("User", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    googleId: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    goalTime: { type: DataTypes.INTEGER, allowNull: true },
    chromaticEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    recordingEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  });
};
