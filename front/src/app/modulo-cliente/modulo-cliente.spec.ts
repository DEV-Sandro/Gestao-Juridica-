import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuloCliente } from './modulo-cliente';

describe('ModuloCliente', () => {
  let component: ModuloCliente;
  let fixture: ComponentFixture<ModuloCliente>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuloCliente]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModuloCliente);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
