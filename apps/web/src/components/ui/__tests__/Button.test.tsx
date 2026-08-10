import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from '../Button';

describe('Button', () => {
  it('рендерить children і викликає onClick', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Зберегти</Button>);
    const button = screen.getByRole('button', { name: 'Зберегти' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled кнопка не викликає onClick і має aria-busy під час isLoading', () => {
    const onClick = jest.fn();
    render(
      <Button onClick={onClick} isLoading>
        Зберегти
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Зберегти' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
