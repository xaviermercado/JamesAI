import { useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const googleAnalyticsId = process.env.EXPO_PUBLIC_GOOGLE_ANALYTICS_ID?.trim();
const hasValidGoogleAnalyticsId = /^G-[A-Z0-9]+$/.test(googleAnalyticsId ?? '');

export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();

  return (
    <html {...htmlAttributes}>
      <head>
        {headNodes}
        {hasValidGoogleAnalyticsId ? (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){window.dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(googleAnalyticsId)});`,
              }}
            />
          </>
        ) : null}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
