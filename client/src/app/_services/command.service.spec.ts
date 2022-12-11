import { TestBed, inject } from '@angular/core/testing';
import { CommandService } from './command.service';

describe('Service: Command', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CommandService]
    });
  });

  it('should ...', inject([CommandService], (service: CommandService) => {
    expect(service).toBeTruthy();
  }));
});
