import { render, screen } from '@testing-library/react';
// ---
import Profile from 'routes/profile';

test('profile route displays placeholder text', () => {
  render(<Profile />);
  const text = screen.getByText(/(Profile)/i);
  expect(text).toBeInTheDocument();
});
