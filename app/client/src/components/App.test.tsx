import { render, screen } from '@testing-library/react';
// ---
import App from 'components/App';

test('renders learn react link', () => {
  render(<App />);
  const text = screen.getByText(/(App)/i);
  expect(text).toBeInTheDocument();
});
