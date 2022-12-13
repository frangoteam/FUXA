import { TestBed, inject } from '@angular/core/testing';
import { DataConverterService } from './data-converter.service';

describe('Service: Data', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DataConverterService]
    });
  });

  it('should ...', inject([DataConverterService], (service: DataConverterService) => {
    expect(service).toBeTruthy();
  }));
});
