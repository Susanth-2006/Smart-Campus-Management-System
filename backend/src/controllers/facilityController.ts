import { FacilityCategory } from '@prisma/client';
import { asyncHandler } from '../utils/errors';
import { prisma } from '../utils/prisma';

export const listFacilities = asyncHandler(async (req, res) => {
  const { q, category } = req.query as Record<string, string | undefined>;
  res.json(await prisma.facility.findMany({
    where: {
      ...(category && { category: category as FacilityCategory }),
      ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { building: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  }));
});
