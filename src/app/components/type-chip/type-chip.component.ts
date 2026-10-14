import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TYPE_INFO, formatName } from '../../utils/pokemon-format';

@Component({
  selector: 'app-type-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [class]="variant()" [class.small]="small()" [style.--type]="info().color">
    <i class="dot"></i>{{ info().label }}
  </span>`,
  styles: `
    :host {
      display: inline-flex;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px 5px 9px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.85;
    }
    .solid {
      color: #fff;
      background: var(--type);
      box-shadow: 0 3px 10px color-mix(in srgb, var(--type) 35%, transparent);
    }
    .soft {
      color: color-mix(in srgb, var(--type) 80%, var(--app-text));
      background: color-mix(in srgb, var(--type) 16%, transparent);
    }
    .glass {
      color: #fff;
      background: rgba(255, 255, 255, 0.22);
      border: 1px solid rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    .small {
      padding: 3px 9px 3px 7px;
      font-size: 0.68rem;
      gap: 5px;
    }
    .small .dot {
      width: 6px;
      height: 6px;
    }
  `,
})
export class TypeChipComponent {
  readonly type = input.required<string>();
  readonly small = input(false);
  readonly variant = input<'solid' | 'soft' | 'glass'>('solid');

  protected readonly info = computed(
    () => TYPE_INFO[this.type()] ?? { label: formatName(this.type()), color: '#777' },
  );
}
