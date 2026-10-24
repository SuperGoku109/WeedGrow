import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Redirect, useLocalSearchParams } from 'expo-router';
import Index from '@/app/index';
jest.mock('expo-router', () => ({ Redirect: () => null, useLocalSearchParams: jest.fn() }));
it('preserves the selected Plants tab when the root URL is reloaded', () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ tabIndex: '1' }); let renderer: any;
  act(() => { renderer = create(React.createElement(Index)); });
  expect(renderer.root.findByType(Redirect).props.href).toEqual({ pathname: '/(tabs)', params: { tabIndex: '1' } });
  act(() => renderer.unmount());
});
