import React from 'react';

const STYLE_ID = 'weedgrow-home-scrollbar';

const scrollbarCss = `
  [data-testid="home-groups-list"],
  [data-testid="home-plants-list"] {
    scrollbar-color: #9fbd70 rgba(19, 34, 25, 0.55);
    scrollbar-width: thin;
  }

  [data-testid="home-groups-list"]::-webkit-scrollbar,
  [data-testid="home-plants-list"]::-webkit-scrollbar {
    width: 8px;
  }

  [data-testid="home-groups-list"]::-webkit-scrollbar-track,
  [data-testid="home-plants-list"]::-webkit-scrollbar-track {
    background: rgba(19, 34, 25, 0.55);
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
    background: linear-gradient(180deg, #c8e78b 0%, #779957 100%);
    border: 2px solid #182a20;
    border-radius: 999px;
  }

  [data-testid="home-groups-list"]::-webkit-scrollbar-thumb:hover,
  [data-testid="home-plants-list"]::-webkit-scrollbar-thumb:hover {
    background: #c8e78b;
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
