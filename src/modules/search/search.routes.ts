import { Router } from 'express';
import { validate } from '@/middleware/validate';
import { searchDoctorsSchema } from '@/modules/search/search.schema';
import { searchDoctorsController } from '@/modules/search/search.controller';

export const searchRouter = Router();

searchRouter.get('/doctors', validate(searchDoctorsSchema, 'query'), searchDoctorsController);