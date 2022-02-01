import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-script-editor',
  templateUrl: './script-editor.component.html',
  styleUrls: ['./script-editor.component.css']
})
export class ScriptEditorComponent implements OnInit {

  content;
  
  constructor() { }

  ngOnInit() {
  }

}
