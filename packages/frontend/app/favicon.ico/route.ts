export function GET(request: Request) {
  return Response.redirect(new URL("/brand/baseplay-mark-transparent.png", request.url), 308);
}
