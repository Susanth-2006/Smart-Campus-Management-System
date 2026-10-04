import { FacilityCategory } from '../generated/prisma/client';
import { asyncHandler } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { oneOf, textParam } from '../utils/query';

export const listFacilities = asyncHandler(async (req, res) => {
  const q = textParam(req.query.q);
  const category = oneOf(req.query.category, Object.values(FacilityCategory), 'category');
  res.json(await prisma.facility.findMany({
    where: {
      ...(category && { category }),
      ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { building: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  }));
});
