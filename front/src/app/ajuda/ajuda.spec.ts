import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ajuda } from './ajuda';

describe('Ajuda', () => {
  let component: Ajuda;
  let fixture: ComponentFixture<Ajuda>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ajuda]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Ajuda);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
