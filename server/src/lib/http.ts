export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Registro") => new HttpError(404, `${what} não encontrado`);
export const badRequest = (msg: string) => new HttpError(400, msg);
export const forbidden = (msg = "Sem permissão") => new HttpError(403, msg);
