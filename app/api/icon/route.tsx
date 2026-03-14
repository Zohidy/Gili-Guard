import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sizeParam = searchParams.get('size');
  const size = sizeParam ? parseInt(sizeParam, 10) : 512;

  return new ImageResponse(
    (
      <div
        style={{
          background: '#080f1e',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: `${size * 0.2}px`,
          border: `${size * 0.04}px solid #ff3c3c`,
        }}
      >
        <div style={{ display: 'flex', fontWeight: 900, color: '#ff3c3c', fontSize: size * 0.28, lineHeight: 1, letterSpacing: '-0.05em' }}>Gili</div>
        <div style={{ display: 'flex', fontWeight: 900, color: '#ddeeff', fontSize: size * 0.2, lineHeight: 1, letterSpacing: '-0.02em' }}>Guard</div>
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
