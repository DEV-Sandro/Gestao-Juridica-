import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type JpButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type JpButtonSize = 'normal' | 'compact';
export type JpButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'jp-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './jp-button.component.html',
  styleUrls: ['./jp-button.component.scss'],
  host: {
    '[class.jp-button-block]': 'block'
  }
})
export class JpButtonComponent {
  @Input() variant: JpButtonVariant = 'primary';
  @Input() size: JpButtonSize = 'normal';
  @Input() type: JpButtonType = 'button';
  @Input() ariaLabel: string | null = null;
  @Input() disabled = false;
  @Input() loading = false;
  @Input() block = false;

  get isDisabled(): boolean {
    return this.disabled || this.loading;
  }
}
