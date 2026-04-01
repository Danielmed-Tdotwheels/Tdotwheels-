class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      const index = this.dataset.index || this.getAttribute('data-index');
      if (cartItems && index) {
        cartItems.updateQuantity(index, 0, event);
      }
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      return this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      return fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '#main-cart-items .js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'header',
        selector: '#cart-icon-bubble',
      },
      {
        id: 'cart-live-region-text',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '#cart-live-region-text',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '#main-cart-footer .js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, event, name, variantId) {
    const isRemove = event.currentTarget instanceof CartRemoveButton;
    const eventTarget = isRemove ? 'clear' : 'change';
    const cartPerformanceUpdateMarker =
      typeof CartPerformance !== 'undefined'
        ? CartPerformance.createStartingMarker(`${eventTarget}:user-action`)
        : null;

    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        const updatePaint = () => {
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          const items = document.querySelectorAll('.cart-item-card');

          if (parsedState.errors) {
            if (quantityElement) quantityElement.value = quantityElement.getAttribute('value');
            this.updateLiveRegions(line, parsedState.errors);
            return;
          }

          this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartDrawerWrapper = document.querySelector('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

          this.getSectionsToRender().forEach((section) => {
            const sectionNode = document.getElementById(section.id);

            if (!sectionNode) {
              return;
            }

            const elementToReplace = sectionNode.querySelector(section.selector) || sectionNode;

            if (parsedState.sections && parsedState.sections[section.section]) {
              const newHTML = this.getSectionInnerHTML(parsedState.sections[section.section], section.selector);
              elementToReplace.innerHTML = newHTML;
            }
          });

          const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
          let message = '';
          if (
            items.length === parsedState.items.length &&
            quantityElement &&
            updatedValue !== parseInt(quantityElement.value)
          ) {
            if (typeof updatedValue === 'undefined') {
              message = window.cartStrings.error;
            } else {
              message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
            }
          }
          this.updateLiveRegions(line, message);

          const lineItem =
            document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (document.querySelector('.cart-item-card') && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
          }
        };

        if (typeof CartPerformance !== 'undefined') {
          CartPerformance.measure(`${eventTarget}:paint-updated-sections`, updatePaint);
        } else {
          updatePaint();
        }

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch((error) => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        if (errors) errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
        if (typeof CartPerformance !== 'undefined' && cartPerformanceUpdateMarker) {
          CartPerformance.measureFromMarker(`${eventTarget}:user-action`, cartPerformanceUpdateMarker);
        }
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    if (this.lineItemStatusElement) this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    if (cartStatus) {
      cartStatus.setAttribute('aria-hidden', false);

      setTimeout(() => {
        cartStatus.setAttribute('aria-hidden', true);
      }, 1000);
    }
  }

  getSectionInnerHTML(html, selector) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const element = doc.querySelector(selector);

    if (!element) {
      console.error(`[Cart] Could not find selector "${selector}" in response HTML`);
      return '';
    }

    return element.innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    if (mainCartItems) mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    if (document.activeElement) document.activeElement.blur();
    if (this.lineItemStatusElement) this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } }).then(() =>
              CartPerformance.measureFromEvent('note-update:user-action', event)
            );
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}

if (!customElements.get('quantity-input')) {
  customElements.define(
    'quantity-input',
    class QuantityInput extends HTMLElement {
      constructor() {
        super();
        this.input = this.querySelector('input');
        this.changeEvent = new Event('change', { bubbles: true });

        if (this.input) {
          this.input.addEventListener('change', this.onInputChange.bind(this));
        }

        this.querySelectorAll('button').forEach((button) =>
          button.addEventListener('click', this.onButtonClick.bind(this))
        );
      }

      onInputChange(event) {
        this.validateQtyRules();
      }

      onButtonClick(event) {
        event.preventDefault();
        const previousValue = this.input.value;

        if (event.target.name === 'plus') {
          this.input.stepUp();
        } else {
          this.input.stepDown();
        }

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
}
