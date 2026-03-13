import { prisma } from './lib/db/prisma'
async function run() {
  const rows = await prisma.dealSnapshot.findMany({
    where: { dealName: { contains: 'Veterinary Cancer' } },
    orderBy: { snapshotAt: 'desc' },
    take: 5
  })
  console.log(JSON.stringify(rows, null, 2))
  await prisma.$disconnect()
}
run()
