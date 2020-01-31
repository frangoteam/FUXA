import { Component, OnInit, Input } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, WindowLink } from '../../../_models/hmi';

@Component({
	selector: 'gauge-valve',
	templateUrl: './valve.component.html',
	styleUrls: ['./valve.component.css']
})
export class ValveComponent extends GaugeBaseComponent implements OnInit {

	@Input() data: any;

	static TypeTag = 'svg-ext-valve';
	static LabelTag = 'Valve';

	constructor() {
		super();
	}

	ngOnInit() {
		if (!this.data) {
			// this.settings.property = new CompressorProperty();
		}
		// let property = JSON.stringify(this.settings.property);
		// this.settings.id = '';
	}

	static getSignals(pro: any) {
		let res: string[] = [];
		if (pro.variableId) {
			res.push(pro.variableId);
		}
		if (pro.alarmId) {
			res.push(pro.alarmId);
		}
		return res;
	}

	static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
		if (svgele.node && svgele.node.children && svgele.node.children.length >= 1) {
			for (let x = 0; x < svgele.node.children.length; x++) {
				let g = svgele.node.children[x];
				let clr = '';
				let val = parseFloat(sig.value);
				if (Number.isNaN(val)) {
					// maybe boolean
					val = Number(sig.value);
				} else {
					val = parseFloat(val.toFixed(5));
				}
				if (ga.property && ga.property.ranges) {
					for (let idx = 0; idx < ga.property.ranges.length; idx++) {
						if (ga.property.ranges[idx].min <= val && ga.property.ranges[idx].max >= val) {
							clr = ga.property.ranges[idx].color;
						}
					}
					g.setAttribute('fill', clr);
				}
			}
		}
	}
}
