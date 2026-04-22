import { useState, useEffect } from "react";
import axios from "axios";
import { api } from "@/config";
import { Search, Upload, UserPlus, Eye, Edit2, Trash2 } from "lucide-react";

interface Student {
  id: number;
  rollNo: string;
  name: string;
  email: string;
  dept: string;
  semester: string;
  status: "Active" | "Inactive" | "Graduated" | "Suspended";
  enrolled: number;
}

const departments = [
  "Computer Science",
  "Electrical Engineering",
  "Business Administration",
  "Mathematics",
  "Physics",
  "Civil Engineering"
];

const semesters = [
  "1st","2nd","3rd","4th","5th","6th","7th","8th"
];

const statusColors: Record<string,string> = {
  Active:"bg-emerald-100 text-emerald-700",
  Inactive:"bg-gray-100 text-gray-600",
  Graduated:"bg-blue-100 text-blue-700",
  Suspended:"bg-red-100 text-red-600"
};

export function Students(){

const [studentsData,setStudentsData]=useState<Student[]>([])
const [search,setSearch]=useState("")
const [showAddModal,setShowAddModal]=useState(false)
const [editStudent,setEditStudent]=useState<Student|null>(null)

const [newStudent,setNewStudent]=useState<Omit<Student,"id">>({
rollNo:"",
name:"",
email:"",
dept:"",
semester:"",
status:"Active",
enrolled:new Date().getFullYear()
})

useEffect(()=>{
fetchStudents()
},[])

const fetchStudents=async()=>{
const res=await axios.get<Student[]>(api("/api/students"))
setStudentsData(res.data)
}

const addStudent=async()=>{
await axios.post(api("/api/students"),newStudent)
setShowAddModal(false)
fetchStudents()
}

const deleteStudent=async(id:number)=>{
if(!window.confirm("Delete student?"))return
await axios.delete(api(`/api/students/${id}`))
fetchStudents()
}

const updateStudent=async()=>{
if(!editStudent)return
await axios.put(api(`/api/students/${editStudent.id}`),editStudent)
setEditStudent(null)
fetchStudents()
}

const importCSV=async(e:React.ChangeEvent<HTMLInputElement>)=>{
const file=e.target.files?.[0]
if(!file)return

const formData=new FormData()
formData.append("file",file)

await axios.post(api("/api/students/import"),formData,{
headers:{ "Content-Type":"multipart/form-data" }
})

fetchStudents()
}

const filtered=studentsData.filter((s)=>{
const q=search.toLowerCase()
return(
s.name.toLowerCase().includes(q)||
s.rollNo.toLowerCase().includes(q)||
s.email.toLowerCase().includes(q)
)
})

return(

<div className="p-4 md:p-6 space-y-5">

<div className="flex items-center justify-between">

<div>
<h1 className="text-gray-800">Students</h1>
<p className="text-sm text-gray-500">Manage library students</p>
</div>

<div className="flex gap-2">

<label className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer">
<Upload size={15}/> Import CSV
<input type="file" accept=".csv" onChange={importCSV} hidden/>
</label>

<button
onClick={()=>setShowAddModal(true)}
className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white bg-blue-600"
>
<UserPlus size={15}/> Add Student
</button>

</div>

</div>

<div className="bg-white p-4 rounded-xl border flex gap-3">

<div className="relative flex-1">

<Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>

<input
type="text"
placeholder="Search student"
value={search}
onChange={(e)=>setSearch(e.target.value)}
className="w-full pl-9 pr-4 py-2 border rounded-lg"
/>

</div>

<span className="text-xs text-gray-400 ml-auto">
{filtered.length} students
</span>

</div>

<div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">

<table className="w-full min-w-[600px]">

<thead className="bg-gray-50">
<tr>
<th className="px-5 py-3 text-left text-xs">Roll</th>
<th className="px-5 py-3 text-left text-xs">Name</th>
<th className="px-5 py-3 text-left text-xs">Dept</th>
<th className="px-5 py-3 text-left text-xs">Semester</th>
<th className="px-5 py-3 text-left text-xs">Status</th>
<th className="px-5 py-3 text-left text-xs">Actions</th>
</tr>
</thead>

<tbody>

{filtered.map((s)=>(
<tr key={s.id} className="border-t">

<td className="px-5 py-3">{s.rollNo}</td>
<td className="px-5 py-3">{s.name}</td>
<td className="px-5 py-3">{s.dept}</td>
<td className="px-5 py-3">{s.semester}</td>

<td className="px-5 py-3">
<span className={`px-2 py-1 text-xs rounded ${statusColors[s.status]}`}>
{s.status}
</span>
</td>

<td className="px-5 py-3 flex gap-2">

<button>
<Eye size={14}/>
</button>

<button onClick={()=>setEditStudent(s)}>
<Edit2 size={14}/>
</button>

<button onClick={()=>deleteStudent(s.id)}>
<Trash2 size={14}/>
</button>

</td>

</tr>
))}

</tbody>
</table>

</div>


{/* ADD STUDENT MODAL */}

{showAddModal &&(

<div className="fixed inset-0 bg-black/40 flex items-center justify-center">

<div className="bg-white p-6 rounded-xl w-[400px] space-y-3">

<h2>Add Student</h2>

<input
placeholder="Roll No"
className="border p-2 w-full"
onChange={(e)=>setNewStudent({...newStudent,rollNo:e.target.value})}
/>

<input
placeholder="Name"
className="border p-2 w-full"
onChange={(e)=>setNewStudent({...newStudent,name:e.target.value})}
/>

<input
placeholder="Email"
className="border p-2 w-full"
onChange={(e)=>setNewStudent({...newStudent,email:e.target.value})}
/>

<select
className="border p-2 w-full"
onChange={(e)=>setNewStudent({...newStudent,dept:e.target.value})}
>
{departments.map((d)=>(
<option key={d}>{d}</option>
))}
</select>

<select
className="border p-2 w-full"
onChange={(e)=>setNewStudent({...newStudent,semester:e.target.value})}
>
{semesters.map((s)=>(
<option key={s}>{s}</option>
))}
</select>

<div className="flex justify-end gap-3">

<button onClick={()=>setShowAddModal(false)}>
Cancel
</button>

<button
onClick={addStudent}
className="bg-blue-600 text-white px-4 py-2 rounded"
>
Add
</button>

</div>

</div>

</div>

)}



{/* EDIT STUDENT MODAL */}

{editStudent &&(

<div className="fixed inset-0 bg-black/40 flex items-center justify-center">

<div className="bg-white p-6 rounded-xl w-[400px] space-y-3">

<h2>Edit Student</h2>

<input
value={editStudent.rollNo}
className="border p-2 w-full"
onChange={(e)=>setEditStudent({...editStudent,rollNo:e.target.value})}
/>

<input
value={editStudent.name}
className="border p-2 w-full"
onChange={(e)=>setEditStudent({...editStudent,name:e.target.value})}
/>

<input
value={editStudent.email}
className="border p-2 w-full"
onChange={(e)=>setEditStudent({...editStudent,email:e.target.value})}
/>

<div className="flex justify-end gap-3">

<button onClick={()=>setEditStudent(null)}>
Cancel
</button>

<button
onClick={updateStudent}
className="bg-blue-600 text-white px-4 py-2 rounded"
>
Update
</button>

</div>

</div>

</div>

)}

</div>

)

}