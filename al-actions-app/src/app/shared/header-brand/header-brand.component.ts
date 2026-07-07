import { Component, Input } from '@angular/core';

@Component({
  selector: 'al-header-brand',
  standalone: true,
  template: `
    <div class="al-header-brand">
      <img src="assets/icon/logo.png" alt="Air Liquide" />
      <span>{{ title }}</span>
    </div>
  `
})
export class HeaderBrandComponent {
  @Input() title = 'AL Actions';
}
