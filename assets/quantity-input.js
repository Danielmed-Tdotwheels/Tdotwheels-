if (!customElements.get('quantity-input')) {
  customElements.define(
    'quantity-input',
    class QuantityInput extends HTMLElement {
      constructor() {
        super();
        console.log('[QuantityInput] Constructor called');
        this.input = this.querySelector('input');
        this.changeEvent = new Event('change', { bubbles: true });

        if (this.input) {
          console.log('[QuantityInput] Input found:', this.input);
          this.input.addEventListener('change', this.onInputChange.bind(this));
        }

        const buttons = this.querySelectorAll('button');
        console.log('[QuantityInput] Found buttons:', buttons.length);

        buttons.forEach((button) => {
          console.log('[QuantityInput] Adding click listener to button:', button.name);
          button.addEventListener('click', this.onButtonClick.bind(this));
        });
      }

      onInputChange(event) {
        console.log('[QuantityInput] Input changed:', this.input.value);
        this.validateQtyRules();
      }

      onButtonClick(event) {
        event.preventDefault();
        console.log('[QuantityInput] Button clicked:', event.target.name);
        const previousValue = this.input.value;

        if (event.target.name === 'plus') {
          this.input.stepUp();
        } else if (event.target.name === 'minus') {
          this.input.stepDown();
        }

        console.log('[QuantityInput] Value changed from', previousValue, 'to', this.input.value);

        if (previousValue !== this.input.value) {
          this.input.dispatchEvent(this.changeEvent);
        }
      }

      validateQtyRules() {
        const value = parseInt(this.input.value);
        if (this.input.min) {
          const min = parseInt(this.input.min);
          const buttonMinus = this.querySelector('button[name="minus"]');
          if (buttonMinus) {
            buttonMinus.disabled = value <= min;
          }
        }
        if (this.input.max) {
          const max = parseInt(this.input.max);
          const buttonPlus = this.querySelector('button[name="plus"]');
          if (buttonPlus) {
            buttonPlus.disabled = value >= max;
          }
        }
      }
    }
  );
  console.log('[QuantityInput] Custom element defined');
}
