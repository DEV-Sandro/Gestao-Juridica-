import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuloAdvogado } from './modulo-advogado';

describe('ModuloAdvogado', () => {
  let component: ModuloAdvogado;
  let fixture: ComponentFixture<ModuloAdvogado>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuloAdvogado]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModuloAdvogado);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
