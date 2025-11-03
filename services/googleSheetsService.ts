import { CartItem, Address } from '../types';

export async function appendOrder(cart: CartItem[], address: Address, total: number): Promise<void> {
  try {
    const response = await fetch('/api/submit-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cart,
        address,
        total,
      }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to submit order. Please try again.' }));
        throw new Error(errorData.message || 'An unknown error occurred while submitting the order.');
    }
  } catch (error) {
    console.error('Error in appendOrder:', error);
    throw error;
  }
}
