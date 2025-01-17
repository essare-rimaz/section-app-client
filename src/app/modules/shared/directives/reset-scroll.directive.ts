import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[resetScroll]',
  host: {
    '[style.cursor]': '"pointer"',
    '[style.userSelect]': '"none"',
  },
  standalone: true,
})
export class ResetScrollDirective {
  @HostListener('click') onClick() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  constructor(private el: ElementRef) {}
}
