import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalhesProcesso } from './detalhes-processo';

describe('DetalhesProcesso', () => {
  let component: DetalhesProcesso;
  let fixture: ComponentFixture<DetalhesProcesso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalhesProcesso]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetalhesProcesso);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
