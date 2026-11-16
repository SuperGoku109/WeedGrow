import React from 'react';

const STYLE_ID = 'weedgrow-home-scrollbar';

const scrollbarCss = `
  [data-testid="home-groups-list"],
  [data-testid="home-plants-list"] {
    scrollbar-color: var(--garden-muted) var(--garden-background);
    scrollbar-width: thin;
  }

  [data-testid="home-groups-list"]::-webkit-scrollbar,
  [data-testid="home-plants-list"]::-webkit-scrollbar {
    width: 8px;
  }

  [data-testid="home-groups-list"]::-webkit-scrollbar-track,
  [data-testid="home-plants-list"]::-webkit-scrollbar-track {
    background: var(--garden-background);
    border-radius: 999px;
  }

  [data-testid="home-groups-list"]::-webkit-scrollbar-button,
  [data-testid="home-plants-list"]::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }

  [data-testid="home-groups-list"]::-webkit-scrollbar-thumb,
  [data-testid="home-plants-list"]::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, var(--garden-accent) 0%, var(--garden-accent) 100%);
    border: 2px solid var(--garden-background);
    border-radius: 999px;
  }

  [data-testid="home-groups-list"]::-webkit-scrollbar-thumb:hover,
  [data-testid="home-plants-list"]::-webkit-scrollbar-thumb:hover {
    background: var(--garden-accent);
  }
`;

export default function HomeScrollbar() {
  React.useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = scrollbarCss;
    document.head.appendChild(style);

    return () => style.remove();
  }, []);

  return null;
}
