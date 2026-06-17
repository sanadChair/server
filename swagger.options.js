import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'SANAD API',
      version: '1.0.0',
      description: 'API documentation',
    },
    servers: [{ url: 'http://localhost:5051' }],
  },
  apis: [path.join(__dirname, 'src/api/v1/**/swagger.yaml')],
};
