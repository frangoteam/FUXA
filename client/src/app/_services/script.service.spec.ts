import { TestBed, inject } from '@angular/core/testing';
import { ScriptService } from './script.service';

describe('Service: Script', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ScriptService]
    });
  });

  it('should ...', inject([ScriptService], (service: ScriptService) => {
    expect(service).toBeTruthy();
  }));
});
