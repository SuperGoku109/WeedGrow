import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function RootHtml({ children }: PropsWithChildren) {
  return <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="application-name" content="BudBuddy" />
      <meta name="apple-mobile-web-app-title" content="BudBuddy" />
      <ScrollViewStyleReset />
    </head>
    <body>{children}</body>
  </html>;
}
