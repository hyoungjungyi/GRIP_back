const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Guitar Practice API",
      version: "1.0.0",
    },
  },
  apis: ["./routes/*.js"], // JSDoc 주석을 파싱할 경로
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
