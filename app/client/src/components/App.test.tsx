import React from 'react';
import { render, screen } from '@testing-library/react';
// components
import App from 'components/App';

test('renders learn react link', () => {
  render(<App />);
  const text = screen.getByText(/(App)/i);
  expect(text).toBeInTheDocument();
});
