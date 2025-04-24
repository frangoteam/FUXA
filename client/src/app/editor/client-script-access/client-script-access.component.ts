import { Component, OnInit } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { ScriptMode, SystemFunctions } from '../../_models/script';
import { ProjectService } from '../../_services/project.service';
import { ClientAccess } from '../../_models/client-access';

@Component({
    selector: 'app-client-script-access',
    templateUrl: './client-script-access.component.html',
    styleUrls: ['./client-script-access.component.scss']
})
export class ClientScriptAccessComponent implements OnInit {

    scriptFunctions: ScriptFunctionAccess[] = [];

    constructor(
        private dialogRef: MatDialogRef<ClientScriptAccessComponent>,
        private projectService: ProjectService
    ) { }

    ngOnInit() {
        const systemFunctions  = new SystemFunctions(ScriptMode.CLIENT);
        const accessConfig: ClientAccess = this.projectService.getClientAccess();

        this.scriptFunctions  = systemFunctions.functions.map(fnc => ({
            name: fnc.name,
            label: fnc.text,
            tooltip: fnc.tooltip,
            enabled: accessConfig?.scriptSystemFunctions?.includes(fnc.name) ?? false
        }));
    }

    getClientAccess(): ClientAccess {
        return {
            scriptSystemFunctions: this.scriptFunctions
                .filter(f => f.enabled)
                .map(f => f.name)
        };
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close();
        const updatedAccess = this.getClientAccess();
        this.projectService.setClientAccess(updatedAccess);
    }
}

interface ScriptFunctionAccess {
    name: string;
    label: string;
    tooltip?: string;
    enabled: boolean;
}
