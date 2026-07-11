import { Request, Response } from 'express';
import { asyncHandler } from '@/lib/asyncHandler';
import {
  getDoctorProfile,
  updateDoctorProfile,
  getDoctorById,
  listDoctors,
  verifyDoctor,
} from '@/modules/doctors/doctor.service';

export const getOwnProfileController = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await getDoctorProfile(req.user!.sub);
  res.status(200).json(doctor);
});

export const updateOwnProfileController = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await updateDoctorProfile(req.user!.sub, req.body);
  res.status(200).json(doctor);
});

export const getDoctorByIdController = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await getDoctorById(req.params.id as string);
  res.status(200).json(doctor);
});

export const listDoctorsController = asyncHandler(async (_req: Request, res: Response) => {
  const doctors = await listDoctors();
  res.status(200).json(doctors);
});

export const verifyDoctorController = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await verifyDoctor(req.params.id as string);
  res.status(200).json(doctor);
});
