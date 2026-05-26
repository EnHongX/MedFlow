import { OperationType, RoleCode } from '@prisma/client';

type PrismaLike = {
  operationLog: { create: (args: any) => Promise<any> };
};

export interface LogParams {
  type: OperationType;
  target: string;
  role: RoleCode;
  result?: string;
  remark?: string;
}

export async function writeLog(prisma: PrismaLike, params: LogParams) {
  await prisma.operationLog.create({
    data: {
      type: params.type,
      target: params.target,
      role: params.role,
      result: params.result || 'success',
      remark: params.remark || null,
    },
  });
}
