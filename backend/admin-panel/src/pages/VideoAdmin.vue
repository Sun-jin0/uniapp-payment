<template>
  <div class="video-admin">
    <div class="header">
      <h2>视频课程管理</h2>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- Content Management -->
      <el-tab-pane label="内容管理" name="content">
        <div class="manage-layout">
          <!-- Sidebar -->
          <div class="manage-sidebar">
            <div class="sidebar-header">
              <span>科目分类</span>
              <el-button type="primary" size="small" @click="openSubjectModal()">添加科目</el-button>
            </div>
            <el-menu :default-openeds="openedSubjects">
              <el-sub-menu v-for="sub in subjects" :key="sub.id" :index="String(sub.id)">
                <template #title>
                  <span class="custom-tree-node">
                    <span>{{ sub.name }}</span>
                    <span class="tree-actions" @click.stop>
                      <el-button type="primary" size="small" @click="openSubjectModal(sub)">编辑</el-button>
                      <el-button type="primary" size="small" @click="openCategoryModal(sub)">添加</el-button>
                      <el-button type="danger" size="small" @click="deleteSubject(sub)">删除</el-button>
                    </span>
                  </span>
                </template>
                <el-menu-item 
                  v-for="cat in sub.categories" 
                  :key="cat.id" 
                  :index="`${sub.id}-${cat.id}`"
                  @click="selectCategory(sub, cat)"
                >
                  <span class="custom-tree-node">
                    <span>{{ cat.name }}</span>
                    <span class="tree-actions" @click.stop>
                      <el-button type="primary" size="small" @click="openCategoryModal(sub, cat)">编辑</el-button>
                      <el-button type="danger" size="small" @click="deleteCategory(cat)">删除</el-button>
                    </span>
                  </span>
                </el-menu-item>
              </el-sub-menu>
            </el-menu>
          </div>

          <!-- Main Content -->
          <div class="manage-main">
            <div class="content-header">
              <h3>{{ currentBreadcrumb }}</h3>
              <div class="header-actions">
                <el-button v-if="selectedResourceIds.length" type="warning" @click="openBatchResourceModal">批量操作 ({{ selectedResourceIds.length }})</el-button>
                <el-button v-if="selectedResourceIds.length" type="success" @click="openBatchGenerateModal">批量生成兑换码</el-button>
                <el-button type="success" @click="fetchResources">刷新</el-button>
                <el-button type="primary" @click="openResourceModal()">新建视频/合集</el-button>
                <el-button type="info" @click="openBatchImportModal">批量导入</el-button>
              </div>
            </div>

            <div class="table-wrapper">
              <el-table
                ref="resourceTableRef"
                v-loading="loading"
                :data="resources"
                @selection-change="handleResourceSelectionChange"
                style="width: 100%; min-width: 900px;"
              >
                <el-table-column type="selection" width="55" />
                <el-table-column label="封面" width="120">
                  <template #default="scope">
                    <el-image 
                      :src="scope.row.cover_url" 
                      style="width: 100px; height: 60px"
                      fit="cover"
                    >
                      <template #error>
                        <div class="image-slot">
                          <el-icon><Picture /></el-icon>
                        </div>
                      </template>
                    </el-image>
                  </template>
                </el-table-column>
                <el-table-column prop="title" label="标题" min-width="150" show-overflow-tooltip />
                <el-table-column label="类型" width="80">
                  <template #default="scope">
                    <el-tag :type="scope.row.type === 'collection' ? 'warning' : 'info'">
                      {{ scope.row.type === 'collection' ? '合集' : '单集' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="权限" width="100">
                  <template #default="scope">
                    <el-tag :type="scope.row.requires_redemption ? 'danger' : 'success'">
                      {{ scope.row.requires_redemption ? '需兑换' : '免费' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="80">
                   <template #default="scope">
                     <el-tag :type="scope.row.is_public ? 'success' : 'info'">
                       {{ scope.row.is_public ? '公开' : '隐藏' }}
                     </el-tag>
                   </template>
                </el-table-column>
                <el-table-column label="操作" width="320" fixed="right">
                  <template #default="scope">
                    <div class="action-buttons">
                      <el-button type="primary" size="small" @click="openResourceModal(scope.row)">编辑</el-button>
                      <el-button type="success" size="small" @click="openGenerateCodeModal(scope.row)">兑换码</el-button>
                      <el-button type="info" size="small" @click="copyExternalLink(scope.row)">链接</el-button>
                      <el-button type="danger" size="small" @click="deleteResource(scope.row)">删除</el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Code Management -->
      <el-tab-pane label="兑换码管理" name="code">
        <div class="filter-bar">
          <el-input v-model="codeKeyword" placeholder="搜索兑换码..." style="width: 300px" @keyup.enter="fetchCodes" />
          <el-button type="primary" @click="fetchCodes">搜索</el-button>
          <el-button type="success" @click="fetchCodes">刷新</el-button>
        </div>
        <div class="table-wrapper">
          <el-table :data="codes" style="width: 100%; min-width: 900px;" v-loading="loading">
            <el-table-column prop="code" label="兑换码" width="180" />
            <el-table-column label="对应资源" min-width="150" show-overflow-tooltip>
              <template #default="scope">
                {{ scope.row.resource_title || scope.row.collection_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.is_used ? 'danger' : 'success'">
                  {{ scope.row.is_used ? '已使用' : '未使用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="使用者" width="180">
              <template #default="scope">
                <span v-if="scope.row.used_by_student_id">
                  {{ scope.row.used_by_student_id }}
                </span>
                <span v-else-if="scope.row.used_by">
                  ID: {{ scope.row.used_by }}
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="used_at" label="使用时间" width="180">
              <template #default="scope">{{ formatDate(scope.row.used_at) }}</template>
            </el-table-column>
            <el-table-column prop="created_at" label="生成时间" width="180">
               <template #default="scope">{{ formatDate(scope.row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="scope">
                <el-button type="danger" size="small" @click="deleteCode(scope.row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- Feedback -->
      <el-tab-pane label="反馈与推荐" name="feedback">
        <div class="filter-bar">
          <el-select v-model="feedbackTypeIndex" @change="fetchFeedbacks">
            <el-option label="全部" :value="0" />
            <el-option label="反馈" :value="1" />
            <el-option label="推荐" :value="2" />
          </el-select>
          <el-button type="primary" @click="fetchFeedbacks">刷新</el-button>
        </div>
        <div class="table-wrapper">
          <el-table :data="feedbacks" style="width: 100%; min-width: 800px;">
            <el-table-column label="类型" width="80">
              <template #default="scope">
                <el-tag>{{ scope.row.type === 'feedback' ? '反馈' : '推荐' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
            <el-table-column prop="resource_title" label="相关视频" width="200" show-overflow-tooltip />
            <el-table-column prop="nickname" label="用户" width="120" />
            <el-table-column prop="created_at" label="时间" width="180">
              <template #default="scope">{{ formatDate(scope.row.created_at) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- Collections -->
      <el-tab-pane label="合集管理" name="collections">
        <div class="content-header">
          <h3>合集列表</h3>
          <div class="header-actions">
            <el-button type="success" @click="fetchCollections">刷新</el-button>
            <el-button type="primary" @click="openCollectionModal()">新建合集</el-button>
          </div>
        </div>
        <div class="table-wrapper">
          <el-table :data="collections" style="width: 100%; min-width: 800px;">
            <el-table-column prop="name" label="合集名称" min-width="200" />
            <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
            <el-table-column prop="sort" label="排序" width="80" />
            <el-table-column label="状态" width="80">
              <template #default="scope">
                <el-tag :type="scope.row.is_active ? 'success' : 'info'">
                  {{ scope.row.is_active ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="scope">{{ formatDate(scope.row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="scope">
                <div class="action-buttons">
                  <el-button type="primary" size="small" @click="openCollectionVideosModal(scope.row)">管理视频</el-button>
                  <el-button type="success" size="small" @click="openCollectionCodeModal(scope.row)">生成兑换码</el-button>
                  <el-button type="primary" size="small" @click="openCollectionModal(scope.row)">编辑</el-button>
                  <el-button type="danger" size="small" @click="deleteCollection(scope.row)">删除</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- Modals -->
    <!-- Subject Modal -->
    <el-dialog v-model="showSubjectModal" :title="editingSubject.id ? '编辑科目' : '新建科目'" width="400px">
      <el-form :model="editingSubject" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="editingSubject.name" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editingSubject.sort" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSubjectModal = false">取消</el-button>
        <el-button type="primary" @click="saveSubject">保存</el-button>
      </template>
    </el-dialog>

    <!-- Category Modal -->
    <el-dialog v-model="showCategoryModal" :title="editingCategory.id ? '编辑分类' : '新建分类'" width="400px">
      <el-form :model="editingCategory" label-width="80px">
        <el-form-item label="所属科目">
          <el-input v-model="editingCategory.subjectName" disabled />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="editingCategory.name" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editingCategory.sort" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCategoryModal = false">取消</el-button>
        <el-button type="primary" @click="saveCategory">保存</el-button>
      </template>
    </el-dialog>

    <!-- Resource Modal -->
    <el-dialog v-model="showResourceModal" :title="editingResource.id ? '编辑视频' : '新建视频'" width="800px">
      <el-form :model="editingResource" label-width="100px">
        <el-row>
          <el-col :span="12">
             <el-form-item label="归属科目">
               <el-select v-model="resourceSubjectIndex" @change="onResourceSubjectChange">
                 <el-option v-for="(sub, idx) in subjects" :key="sub.id" :label="sub.name" :value="idx" />
               </el-select>
             </el-form-item>
          </el-col>
          <el-col :span="12">
             <el-form-item label="归属分类">
               <el-select v-model="resourceCategoryIndex" @change="onResourceCategoryChange">
                 <el-option v-for="(cat, idx) in resourceCategories" :key="cat.id" :label="cat.name" :value="idx" />
               </el-select>
             </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="B站快速识别">
          <el-input v-model="biliQuickInput" placeholder="粘贴 B站 分享文字，如：【标题】链接">
            <template #append>
              <el-button @click="handleBiliParse">识别</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="标题">
          <el-input v-model="editingResource.title" />
        </el-form-item>
        <el-form-item label="B站链接">
          <el-input v-model="editingResource.bili_link" placeholder="合集主链接/单集链接" />
        </el-form-item>
        <el-form-item label="封面URL">
          <el-input v-model="editingResource.cover_url" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="editingResource.description" type="textarea" />
        </el-form-item>
        
        <el-row>
           <el-col :span="8">
             <el-form-item label="类型">
               <el-radio-group v-model="editingResource.type">
                 <el-radio label="single">单集</el-radio>
                 <el-radio label="collection">合集</el-radio>
               </el-radio-group>
             </el-form-item>
           </el-col>
           <el-col :span="8">
             <el-form-item label="权限">
               <el-radio-group v-model="editingResource.requires_redemption">
                 <el-radio :label="0">免费</el-radio>
                 <el-radio :label="1">需兑换</el-radio>
               </el-radio-group>
             </el-form-item>
           </el-col>
           <el-col :span="8">
             <el-form-item label="公开">
               <el-switch v-model="editingResource.is_public" :active-value="1" :inactive-value="0" />
             </el-form-item>
           </el-col>
        </el-row>

        <!-- Video Items -->
        <div class="video-items-section">
          <div class="section-header">
            <h4>视频列表 ({{ editingResource.items ? editingResource.items.length : 0 }})</h4>
            <el-button size="small" @click="addVideoItem">添加视频</el-button>
          </div>
          <div v-for="(item, idx) in editingResource.items" :key="idx" class="video-item-row">
             <span class="idx">{{ idx + 1 }}</span>
             <el-input v-model="item.title" placeholder="标题" style="width: 200px" />
             <el-input v-model="item.url" placeholder="OSS URL" style="flex: 1" />
             <el-input v-model="item.duration" placeholder="时长" style="width: 80px" />
             <el-button link type="danger" @click="removeVideoItem(idx)">×</el-button>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="showResourceModal = false">取消</el-button>
        <el-button type="primary" @click="saveResource">保存</el-button>
      </template>
    </el-dialog>

    <!-- Generate Code Modal -->
    <el-dialog v-model="showGenerateModal" title="生成兑换码" width="400px">
       <el-form label-width="100px">
         <el-form-item label="资源">
           <span>{{ generatingResource?.title }}</span>
         </el-form-item>
         <el-form-item label="数量">
           <el-input-number v-model="generateCount" :min="1" />
         </el-form-item>
         <el-form-item v-if="generatedCodes.length" label="结果">
           <div style="display: flex; flex-direction: column; gap: 8px;">
             <div v-for="(code, index) in generatedCodes" :key="index" style="display: flex; align-items: center; gap: 8px;">
               <el-input :value="code" readonly style="flex: 1;" />
               <el-button type="primary" size="small" @click="copySingleCode(code)">复制</el-button>
             </div>
           </div>
         </el-form-item>
       </el-form>
       <template #footer>
         <el-button @click="showGenerateModal = false">关闭</el-button>
         <el-button v-if="!generatedCodes.length" type="primary" @click="confirmGenerate">生成</el-button>
       </template>
    </el-dialog>

    <!-- Batch Resource Modal -->
    <el-dialog v-model="showBatchResourceModal" title="批量操作视频资源" width="600px">
      <el-form :model="batchData" label-width="120px">
        <el-form-item label="选中资源数量">
          <span style="font-weight: bold; color: #409EFF;">{{ selectedResourceIds.length }} 个</span>
        </el-form-item>
        <el-form-item label="移动到分类">
          <div style="display: flex; gap: 10px;">
            <el-select 
              v-model="batchSelectedSubjectId" 
              placeholder="选择科目" 
              style="width: 180px"
              @change="batchSelectedCategoryId = null"
            >
              <el-option 
                v-for="sub in subjects" 
                :key="sub.id" 
                :label="sub.name" 
                :value="sub.id" 
              />
            </el-select>
            <el-select 
              v-model="batchSelectedCategoryId" 
              placeholder="选择分类" 
              style="width: 180px"
              :disabled="!batchSelectedSubjectId"
            >
              <el-option 
                v-for="cat in getSubjectCategories(batchSelectedSubjectId)" 
                :key="cat.id" 
                :label="cat.name" 
                :value="cat.id" 
              />
            </el-select>
          </div>
          <div v-if="batchSelectedSubjectId && batchSelectedCategoryId" style="margin-top: 8px; color: #67C23A; font-size: 12px;">
            将移动到: {{ getSubjectName(batchSelectedSubjectId) }} / {{ getCategoryName(batchSelectedCategoryId) }}
          </div>
        </el-form-item>
        <el-form-item label="修改观看权限">
          <el-radio-group v-model="batchData.requires_redemption">
            <el-radio :label="0">免费</el-radio>
            <el-radio :label="1">需兑换</el-radio>
            <el-radio :label="-1">不修改</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="修改公开状态">
          <el-radio-group v-model="batchData.is_public">
            <el-radio :value="1">公开</el-radio>
            <el-radio :value="0">隐藏</el-radio>
            <el-radio :value="-1">不修改</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBatchResourceModal = false">取消</el-button>
        <el-button type="primary" @click="confirmBatchResource">确定</el-button>
      </template>
    </el-dialog>

    <!-- Batch Generate Code Modal -->
    <el-dialog v-model="showBatchGenerateModal" title="生成兑换码" width="500px">
      <el-form label-width="120px">
        <el-form-item label="选中资源数量">
          <span>{{ selectedResourceIds.length }} 个</span>
        </el-form-item>
        <el-form-item label="生成数量">
          <el-input-number v-model="batchGenerateCount" :min="1" :max="100" />
          <span style="margin-left: 8px">个兑换码</span>
        </el-form-item>
        <el-form-item label="预计生成">
          <span style="font-weight: bold; color: #409EFF">{{ batchGenerateCount }} 个兑换码，每个可访问 {{ selectedResourceIds.length }} 个资源</span>
        </el-form-item>
        <el-form-item v-if="batchGeneratedCodes.length" label="生成结果">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div v-for="(code, index) in batchGeneratedCodes" :key="index" style="display: flex; align-items: center; gap: 8px;">
              <el-input :value="code" readonly style="flex: 1;" />
              <el-button type="primary" size="small" @click="copySingleCode(code)">复制</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBatchGenerateModal = false">关闭</el-button>
        <el-button v-if="!batchGeneratedCodes.length" type="primary" @click="confirmBatchGenerate">生成</el-button>
      </template>
    </el-dialog>

    <!-- Collection Edit Modal -->
    <el-dialog v-model="showCollectionModal" :title="editingCollection.id ? '编辑合集' : '新建合集'" width="500px">
      <el-form :model="editingCollection" label-width="100px">
        <el-form-item label="合集名称">
          <el-input v-model="editingCollection.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editingCollection.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="封面图">
          <el-input v-model="editingCollection.cover_url" placeholder="封面图URL" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editingCollection.sort" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="editingCollection.is_active" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCollectionModal = false">取消</el-button>
        <el-button type="primary" @click="confirmCollection">确定</el-button>
      </template>
    </el-dialog>

    <!-- Collection Videos Modal -->
    <el-dialog v-model="showCollectionVideosModal" title="管理合集视频" width="900px">
      <div v-if="editingCollectionVideos" class="collection-videos-manager">
        <p style="margin-bottom: 16px">合集：{{ editingCollectionVideos.name }}</p>
        
        <div class="collection-layout">
          <!-- Left: Available videos grouped by subject -->
          <div class="available-videos">
            <div class="panel-header">可选视频</div>
            <el-input
              v-model="videoSearchKeyword"
              placeholder="搜索视频..."
              clearable
              class="search-input"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-collapse v-model="expandedSubjects" class="subject-collapse">
              <el-collapse-item
                v-for="(videos, subjectName) in filteredGroupedVideos"
                :key="subjectName"
                :title="`${subjectName} (${videos.length})`"
                :name="subjectName"
              >
                <el-checkbox-group v-model="selectedCollectionVideoIds" class="video-checkbox-group">
                  <el-checkbox
                    v-for="video in videos"
                    :key="video.id"
                    :label="video.id"
                    class="video-checkbox"
                  >
                    {{ video.title }}
                  </el-checkbox>
                </el-checkbox-group>
              </el-collapse-item>
            </el-collapse>
          </div>
          
          <!-- Right: Selected videos -->
          <div class="selected-videos">
            <div class="panel-header">已选视频 ({{ selectedCollectionVideoIds.length }})</div>
            <div class="selected-list">
              <div
                v-for="video in selectedVideosInfo"
                :key="video.id"
                class="selected-item"
              >
                <span class="selected-title">{{ video.title }}</span>
                <el-button
                  type="danger"
                  link
                  size="small"
                  @click="removeSelectedVideo(video.id)"
                >
                  移除
                </el-button>
              </div>
              <el-empty v-if="selectedCollectionVideoIds.length === 0" description="暂无已选视频" />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showCollectionVideosModal = false">取消</el-button>
        <el-button type="primary" @click="confirmCollectionVideos">保存</el-button>
      </template>
    </el-dialog>

    <!-- Collection Code Modal -->
    <el-dialog v-model="showCollectionCodeModal" title="生成合集兑换码" width="500px">
      <div v-if="generatingCollection">
        <el-form label-width="120px">
          <el-form-item label="合集名称">
            <span>{{ generatingCollection.name }}</span>
          </el-form-item>
          <el-form-item label="视频数量">
            <span>{{ editingCollectionVideos?.videos?.length || 0 }} 个</span>
          </el-form-item>
          <el-form-item label="生成数量">
            <el-input-number v-model="collectionGenerateCount" :min="1" :max="100" />
            <span style="margin-left: 8px">个兑换码</span>
          </el-form-item>
          <el-form-item label="预计生成">
            <span style="font-weight: bold; color: #409EFF">{{ collectionGenerateCount }} 个兑换码，每个可访问合集内所有视频</span>
          </el-form-item>
          <el-form-item v-if="collectionGeneratedCodes.length" label="生成结果">
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div v-for="(code, index) in collectionGeneratedCodes" :key="index" style="display: flex; align-items: center; gap: 8px;">
                <el-input :value="code" readonly style="flex: 1;" />
                <el-button type="primary" size="small" @click="copySingleCode(code)">复制</el-button>
              </div>
            </div>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showCollectionCodeModal = false">关闭</el-button>
        <el-button v-if="!collectionGeneratedCodes.length" type="primary" @click="confirmCollectionCode">生成</el-button>
      </template>
    </el-dialog>

    <!-- Batch Import Modal -->
    <el-dialog v-model="showBatchImportModal" title="批量导入视频集合" width="700px">
      <el-form :model="batchImportData" label-width="100px">
        <el-form-item label="集合名称" required>
          <el-input v-model="batchImportData.collectionName" placeholder="请输入视频集合名称" />
        </el-form-item>
        <el-form-item label="选择科目" required>
          <el-select v-model="batchImportData.subjectId" placeholder="请选择科目" style="width: 100%">
            <el-option
              v-for="sub in subjects"
              :key="sub.id"
              :label="sub.name"
              :value="sub.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="选择分类">
          <el-select v-model="batchImportData.categoryId" placeholder="请选择分类（可选）" style="width: 100%" clearable>
            <el-option
              v-for="cat in getCategoriesBySubject(batchImportData.subjectId)"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="导入方式">
          <el-radio-group v-model="batchImportData.importType">
            <el-radio label="file">上传JSON文件</el-radio>
            <el-radio label="paste">粘贴JSON内容</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="batchImportData.importType === 'file'" label="选择文件">
          <el-upload
            ref="uploadRef"
            action="#"
            :auto-upload="false"
            :on-change="handleFileChange"
            :limit="1"
            accept=".json"
          >
            <el-button type="primary">选择JSON文件</el-button>
            <template #tip>
              <div class="el-upload__tip">请上传包含视频列表的JSON文件</div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item v-else label="JSON内容">
          <el-input
            v-model="batchImportData.jsonContent"
            type="textarea"
            :rows="10"
            placeholder="请粘贴JSON内容，格式参考：
{
  &quot;data&quot;: {
    &quot;list&quot;: [
      {
        &quot;lessonName&quot;: &quot;视频标题&quot;,
        &quot;lessonUrl&quot;: &quot;视频链接&quot;
      }
    ]
  }
}"
          />
        </el-form-item>
        <el-form-item label="权限设置">
          <el-switch
            v-model="batchImportData.requiresRedemption"
            :active-value="1"
            :inactive-value="0"
            active-text="需要兑换"
            inactive-text="免费"
          />
        </el-form-item>
        <el-form-item label="公开状态">
          <el-switch
            v-model="batchImportData.isPublic"
            :active-value="1"
            :inactive-value="0"
            active-text="公开"
            inactive-text="隐藏"
          />
        </el-form-item>
        <el-form-item v-if="importPreview.length > 0" label="预览">
          <div style="max-height: 200px; overflow-y: auto; border: 1px solid #dcdfe6; border-radius: 4px; padding: 10px;">
            <div v-for="(item, index) in importPreview" :key="index" style="padding: 5px 0; border-bottom: 1px solid #ebeef5;">
              <span style="font-weight: bold;">{{ index + 1 }}.</span> {{ item.title }}
            </div>
          </div>
          <div style="margin-top: 8px; color: #409EFF;">共 {{ importPreview.length }} 个视频</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBatchImportModal = false">取消</el-button>
        <el-button type="primary" @click="previewImport" v-if="importPreview.length === 0">预览</el-button>
        <el-button type="success" @click="confirmBatchImport" v-else>确认导入</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { adminVideoApi } from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';
import { decryptVideoUrl, encryptVideoUrl } from '../utils/videoEncryption';
import { Picture, Search } from '@element-plus/icons-vue';

const activeTab = ref('content');
const subjects = ref([]);
const openedSubjects = computed(() => subjects.value.map(s => String(s.id)));
const resources = ref([]);
const loading = ref(false);
const selectedSubjectId = ref(null);
const selectedCategoryId = ref(null);

// Collection videos management
const videoSearchKeyword = ref('');
const expandedSubjects = ref([]);

// Modals
const showSubjectModal = ref(false);
const editingSubject = ref({});
const showCategoryModal = ref(false);
const editingCategory = ref({});
const showResourceModal = ref(false);
const editingResource = ref({ items: [] });
const resourceSubjectIndex = ref(0);
const resourceCategoryIndex = ref(0);
const resourceCategories = ref([]);

const showGenerateModal = ref(false);
const generatingResource = ref(null);
const generateCount = ref(1);
const generatedCodes = ref([]);

const showBatchResourceModal = ref(false);
const batchData = ref({ requires_redemption: -1, is_public: -1, category_id: null });
const batchSelectedSubjectId = ref(null);
const batchSelectedCategoryId = ref(null);

const showBatchGenerateModal = ref(false);
const batchGenerateCount = ref(1);
const batchGeneratedCodes = ref([]);

const codeKeyword = ref('');
const codes = ref([]);

const feedbacks = ref([]);
const feedbackTypeIndex = ref(0);
const biliQuickInput = ref('');

const selectedResourceIds = ref([]);
const resourceTableRef = ref(null);

// Collections
const collections = ref([]);
const showCollectionModal = ref(false);
const editingCollection = ref({});
const showCollectionVideosModal = ref(false);
const editingCollectionVideos = ref(null);
const availableResources = ref([]);
const selectedCollectionVideoIds = ref([]);
const showCollectionCodeModal = ref(false);
const generatingCollection = ref(null);
const collectionGenerateCount = ref(1);
const collectionGeneratedCodes = ref([]);

// Batch Import
const showBatchImportModal = ref(false);
const batchImportData = ref({
  collectionName: '',
  subjectId: null,
  categoryId: null,
  importType: 'file',
  jsonContent: '',
  requiresRedemption: 1,
  isPublic: 1
});
const importPreview = ref([]);
const uploadRef = ref(null);
const selectedFile = ref(null);

const formatDate = (str) => str ? new Date(str).toLocaleString() : '-';

// Group available resources by subject for collection management
const filteredGroupedVideos = computed(() => {
  const grouped = {};
  const keyword = videoSearchKeyword.value.toLowerCase();
  
  availableResources.value.forEach(resource => {
    // Filter by search keyword
    if (keyword && !resource.title.toLowerCase().includes(keyword)) {
      return;
    }
    
    const subjectName = resource.subject_name || '未分类';
    if (!grouped[subjectName]) {
      grouped[subjectName] = [];
    }
    grouped[subjectName].push(resource);
  });
  
  return grouped;
});

// Get selected videos info
const selectedVideosInfo = computed(() => {
  return availableResources.value.filter(r => selectedCollectionVideoIds.value.includes(r.id));
});

// Remove selected video
const removeSelectedVideo = (videoId) => {
  const index = selectedCollectionVideoIds.value.indexOf(videoId);
  if (index > -1) {
    selectedCollectionVideoIds.value.splice(index, 1);
  }
};

// Fetch Data
const fetchSubjects = async () => {
  try {
    const res = await adminVideoApi.getSubjects();
    if (res.code === 0) subjects.value = res.data || [];
  } catch (e) {
    console.error(e);
  }
};

const fetchResources = async () => {
  loading.value = true;
  const params = {};
  if (selectedCategoryId.value) params.category_id = selectedCategoryId.value;
  else if (selectedSubjectId.value) params.subject_id = selectedSubjectId.value;
  
  try {
    const res = await adminVideoApi.getResources(params);
    if (res.code === 0) resources.value = res.data || [];
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const selectCategory = (sub, cat) => {
  selectedSubjectId.value = sub.id;
  selectedCategoryId.value = cat.id;
  fetchResources();
};

const currentBreadcrumb = computed(() => {
  if (selectedCategoryId.value) {
     const sub = subjects.value.find(s => s.id === selectedSubjectId.value);
     const cat = sub?.categories?.find(c => c.id === selectedCategoryId.value);
     return `${sub?.name || ''} / ${cat?.name || ''}`;
  }
  return '所有视频';
});

// Helper functions for batch operations
const getSubjectCategories = (subjectId) => {
  if (!subjectId) return [];
  const sub = subjects.value.find(s => s.id === subjectId);
  return sub?.categories || [];
};

const getSubjectName = (subjectId) => {
  const sub = subjects.value.find(s => s.id === subjectId);
  return sub?.name || '';
};

const getCategoryName = (categoryId) => {
  for (const sub of subjects.value) {
    const cat = sub.categories?.find(c => c.id === categoryId);
    if (cat) return cat.name;
  }
  return '';
};

// Subject CRUD
const openSubjectModal = (sub = null) => {
  editingSubject.value = sub ? { ...sub } : { name: '', sort: 0 };
  showSubjectModal.value = true;
};

const saveSubject = async () => {
  try {
    if (editingSubject.value.id) {
      await adminVideoApi.updateSubject(editingSubject.value.id, editingSubject.value);
    } else {
      await adminVideoApi.createSubject(editingSubject.value);
    }
    showSubjectModal.value = false;
    fetchSubjects();
  } catch (e) {
    ElMessage.error('操作失败');
  }
};

const deleteSubject = (sub) => {
  ElMessageBox.confirm(`确定删除科目 ${sub.name} 吗？`, '提示').then(async () => {
    await adminVideoApi.deleteSubject(sub.id);
    fetchSubjects();
  });
};

// Category CRUD
const openCategoryModal = (sub, cat = null) => {
  editingCategory.value = cat 
    ? { ...cat, subjectName: sub.name, parent_id: sub.id }
    : { name: '', sort: 0, subjectName: sub.name, parent_id: sub.id };
  showCategoryModal.value = true;
};

const saveCategory = async () => {
  try {
    if (editingCategory.value.id) {
      await adminVideoApi.updateCategory(editingCategory.value.id, editingCategory.value);
    } else {
      await adminVideoApi.createCategory(editingCategory.value);
    }
    showCategoryModal.value = false;
    fetchSubjects();
  } catch (e) {
    ElMessage.error('操作失败');
  }
};

const deleteCategory = (cat) => {
  ElMessageBox.confirm(`确定删除分类 ${cat.name} 吗？`, '提示').then(async () => {
    await adminVideoApi.deleteCategory(cat.id);
    fetchSubjects();
  });
};

// Resource CRUD
const openResourceModal = async (res = null) => {
    // Init Pickers
    if (subjects.value.length > 0) {
        resourceSubjectIndex.value = 0;
        updateResourceCategories();
    }
    
    if (res) {
        const detailRes = await adminVideoApi.getResourceDetail(res.id);
        const data = detailRes.data || { ...res, items: [] };
        
        // Decrypt
        if (data.items) {
          data.items.forEach(item => {
            if (item.url) item.url = decryptVideoUrl(item.url);
          });
        }
        editingResource.value = data;
        
        // Set Picker Indices
        // (Simplified matching logic)
    } else {
        editingResource.value = {
            title: '',
            type: 'single',
            requires_redemption: 0,
            is_public: 1,
            items: [],
            category_id: resourceCategories.value[0]?.id
        };
    }
    showResourceModal.value = true;
};

const updateResourceCategories = () => {
    const sub = subjects.value[resourceSubjectIndex.value];
    resourceCategories.value = sub ? (sub.categories || []) : [];
    resourceCategoryIndex.value = 0;
};

const onResourceSubjectChange = (val) => {
    resourceSubjectIndex.value = val;
    updateResourceCategories();
};

const onResourceCategoryChange = (val) => {
    resourceCategoryIndex.value = val;
};

const saveResource = async () => {
    const cat = resourceCategories.value[resourceCategoryIndex.value];
    if (!cat) return ElMessage.warning('请选择分类');
    
    const data = JSON.parse(JSON.stringify(editingResource.value));
    data.category_id = cat.id;
    
    // Encrypt
    if (data.items) {
        data.items.forEach(item => {
            if (item.url) item.url = encryptVideoUrl(item.url);
        });
    }
    
    try {
        if (data.id) {
            // 更新现有资源 - 局部更新
            const res = await adminVideoApi.updateResource(data.id, data);
            if (res.code === 0) {
                // 找到并更新本地数据
                const index = resources.value.findIndex(r => r.id === data.id);
                if (index !== -1) {
                    resources.value[index] = { ...resources.value[index], ...data };
                }
                ElMessage.success('更新成功');
            }
        } else {
            // 创建新资源 - 需要重新获取以获取完整数据（包括生成的ID）
            await adminVideoApi.createResource(data);
            fetchResources();
            ElMessage.success('创建成功');
        }
        showResourceModal.value = false;
    } catch(e) {
        ElMessage.error('保存失败');
    }
};

const deleteResource = (res) => {
    ElMessageBox.confirm('确定删除吗？', '提示').then(async () => {
        await adminVideoApi.deleteResource(res.id);
        // 从本地列表中移除
        const index = resources.value.findIndex(r => r.id === res.id);
        if (index !== -1) {
            resources.value.splice(index, 1);
        }
        ElMessage.success('删除成功');
    });
};

const handleResourceSelectionChange = (val) => {
    selectedResourceIds.value = val.map(v => v.id);
};

const openBatchResourceModal = () => {
    batchData.value = { requires_redemption: -1, is_public: -1 };
    batchSelectedSubjectId.value = null;
    batchSelectedCategoryId.value = null;
    showBatchResourceModal.value = true;
};

const confirmBatchResource = async () => {
    if (selectedResourceIds.value.length === 0) {
        ElMessage.warning('请先选择要操作的资源');
        return;
    }
    
    const updateData = {};
    
    // 添加分类修改
    if (batchSelectedCategoryId.value) {
        updateData.category_id = batchSelectedCategoryId.value;
    }
    
    if (batchData.value.requires_redemption !== -1) {
        updateData.requires_redemption = batchData.value.requires_redemption;
    }
    if (batchData.value.is_public !== -1) {
        updateData.is_public = batchData.value.is_public;
    }
    
    // 过滤掉 null 和 undefined 值
    Object.keys(updateData).forEach(key => {
        if (updateData[key] === null || updateData[key] === undefined) {
            delete updateData[key];
        }
    });
    
    if (Object.keys(updateData).length === 0) {
        ElMessage.warning('请至少选择一项要修改的内容');
        return;
    }
    
    try {
        const idsToUpdate = [...selectedResourceIds.value]; // 保存ID列表
        await adminVideoApi.batchUpdateResources(idsToUpdate, updateData);
        // 局部更新选中的资源
        resources.value = resources.value.map(r => {
            if (idsToUpdate.includes(r.id)) {
                return { ...r, ...updateData };
            }
            return r;
        });
        ElMessage.success('批量操作成功');
        showBatchResourceModal.value = false;
        // 清空表格选择
        if (resourceTableRef.value) {
            resourceTableRef.value.clearSelection();
        }
        selectedResourceIds.value = [];
    } catch (e) {
        console.error('批量操作失败:', e);
        ElMessage.error('批量操作失败: ' + (e.message || '未知错误'));
    }
};

const openBatchGenerateModal = () => {
    if (selectedResourceIds.value.length === 0) {
        ElMessage.warning('请先选择要生成兑换码的资源');
        return;
    }
    batchGenerateCount.value = 1;
    batchGeneratedCodes.value = [];
    showBatchGenerateModal.value = true;
};

const confirmBatchGenerate = async () => {
    if (selectedResourceIds.value.length === 0) {
        ElMessage.warning('请先选择要生成兑换码的资源');
        return;
    }
    
    try {
        const res = await adminVideoApi.generateCodes({
            resourceIds: selectedResourceIds.value,
            count: batchGenerateCount.value
        });
        if (res.code === 0) {
            batchGeneratedCodes.value = res.data;
            ElMessage.success(`成功生成 ${res.data.length} 个兑换码，每个可访问 ${selectedResourceIds.value.length} 个资源`);
        }
    } catch (e) {
        ElMessage.error('生成兑换码失败');
    }
};

const copySingleCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
        ElMessage.success('已复制到剪贴板');
    }).catch(() => {
        ElMessage.error('复制失败');
    });
};

const handleBiliParse = async () => {
    if (!biliQuickInput.value) {
        ElMessage.warning('请输入B站分享文字');
        return;
    }

    // Extract URL from input text
    const urlMatch = biliQuickInput.value.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) {
        ElMessage.warning('未找到有效链接');
        return;
    }

    const url = urlMatch[0];
    const loading = ElMessage({
        message: '解析中...',
        duration: 0,
        type: 'info'
    });
    
    try {
        const res = await adminVideoApi.parseBiliLink(url);
        loading.close();
        
        if (res.code === 0) {
            const data = res.data;
            // 如果主标题为空，则填充主标题
            if (!editingResource.value.title) {
                editingResource.value.title = data.title;
            }
            // 填充主链接和封面等
            editingResource.value.bili_link = data.bili_link || editingResource.value.bili_link;
            editingResource.value.cover_url = data.cover_url || editingResource.value.cover_url;
            editingResource.value.description = data.description || editingResource.value.description;
            
            // 自动添加到视频列表
            if (!editingResource.value.items) editingResource.value.items = [];
            editingResource.value.items.push({
                title: data.title,
                bili_link: data.bili_link,
                url: '',
                duration: ''
            });

            ElMessage.success('识别成功');
        } else {
            ElMessage.error(res.message || '识别失败');
        }
    } catch(e) {
        loading.close();
        console.error('解析出错:', e);
        ElMessage.error('解析出错: ' + (e.message || '未知错误'));
    }
};

const addVideoItem = () => {
    if (!editingResource.value.items) editingResource.value.items = [];
    editingResource.value.items.push({ title: '', url: '', duration: '' });
};

const removeVideoItem = (idx) => {
    editingResource.value.items.splice(idx, 1);
};

const copyExternalLink = (res) => {
    const link = `https://your-domain.com/video/${res.vid}`;
    navigator.clipboard.writeText(link).then(() => {
        ElMessage.success('链接已复制到剪贴板');
    }).catch(() => {
        ElMessage.error('复制失败');
    });
};

// Codes
const fetchCodes = async () => {
    const res = await adminVideoApi.getCodes({ keyword: codeKeyword.value });
    if (res.code === 0) codes.value = res.data || [];
};

const openGenerateCodeModal = (res) => {
    generatingResource.value = res;
    generateCount.value = 1;
    generatedCodes.value = [];
    showGenerateModal.value = true;
};

const confirmGenerate = async () => {
    const res = await adminVideoApi.generateCodes({
        resourceIds: [generatingResource.value.id],
        count: generateCount.value
    });
    if (res.code === 0) generatedCodes.value = res.data;
};

// Feedbacks
const fetchFeedbacks = async () => {
    const typeMap = ['', 'feedback', 'recommend'];
    const params = {};
    if (feedbackTypeIndex.value > 0) params.type = typeMap[feedbackTypeIndex.value];
    const res = await adminVideoApi.getFeedbacks(params);
    if (res.code === 0) feedbacks.value = res.data || [];
};

// Collections
const fetchCollections = async () => {
    const res = await adminVideoApi.getCollections();
    if (res.code === 0) collections.value = res.data || [];
};

const openCollectionModal = (collection = null) => {
    editingCollection.value = collection ? { ...collection } : { name: '', description: '', cover_url: '', sort: 0, is_active: 1 };
    showCollectionModal.value = true;
};

const confirmCollection = async () => {
    try {
        if (editingCollection.value.id) {
            // 更新现有合集 - 局部更新
            const res = await adminVideoApi.updateCollection(editingCollection.value.id, editingCollection.value);
            if (res.code === 0) {
                const index = collections.value.findIndex(c => c.id === editingCollection.value.id);
                if (index !== -1) {
                    collections.value[index] = { ...collections.value[index], ...editingCollection.value };
                }
                ElMessage.success('更新成功');
            }
        } else {
            // 创建新合集 - 需要重新获取以获取完整数据（包括生成的ID）
            await adminVideoApi.createCollection(editingCollection.value);
            fetchCollections();
            ElMessage.success('创建成功');
        }
        showCollectionModal.value = false;
    } catch (e) {
        ElMessage.error('操作失败');
    }
};

const deleteCollection = async (collection) => {
    try {
        await ElMessageBox.confirm('确定删除此合集吗？', '确认删除', { type: 'warning' });
        await adminVideoApi.deleteCollection(collection.id);
        // 从本地列表中移除
        const index = collections.value.findIndex(c => c.id === collection.id);
        if (index !== -1) {
            collections.value.splice(index, 1);
        }
        ElMessage.success('删除成功');
    } catch (e) {
        if (e !== 'cancel') ElMessage.error('删除失败');
    }
};

const openCollectionVideosModal = async (collection) => {
    editingCollectionVideos.value = collection;
    videoSearchKeyword.value = '';
    
    const detailRes = await adminVideoApi.getCollectionDetail(collection.id);
    if (detailRes.code === 0) {
        editingCollectionVideos.value = detailRes.data;
        selectedCollectionVideoIds.value = detailRes.data.videos.map(v => v.resource_id);
    }
    
    const resourcesRes = await adminVideoApi.getResources({ status: 1 });
    if (resourcesRes.code === 0) {
        availableResources.value = resourcesRes.data;
        // Auto-expand all subjects
        const subjects = new Set(resourcesRes.data.map(r => r.subject_name || '未分类'));
        expandedSubjects.value = Array.from(subjects);
    }
    
    showCollectionVideosModal.value = true;
};

const confirmCollectionVideos = async () => {
    try {
        await adminVideoApi.updateCollectionVideos({
            collectionId: editingCollectionVideos.value.id,
            videoIds: selectedCollectionVideoIds.value
        });
        ElMessage.success('更新成功');
        showCollectionVideosModal.value = false;
    } catch (e) {
        ElMessage.error('更新失败');
    }
};

const openCollectionCodeModal = (collection) => {
    generatingCollection.value = collection;
    collectionGenerateCount.value = 1;
    collectionGeneratedCodes.value = [];
    showCollectionCodeModal.value = true;
};

const confirmCollectionCode = async () => {
    try {
        const res = await adminVideoApi.generateCollectionCodes({
            collectionId: generatingCollection.value.id,
            count: collectionGenerateCount.value
        });
        if (res.code === 0) {
            collectionGeneratedCodes.value = res.data;
            ElMessage.success(`成功生成 ${res.data.length} 个兑换码`);
        }
    } catch (e) {
        ElMessage.error('生成兑换码失败');
    }
};

// 自动刷新当前标签页的数据
const refreshCurrentTab = () => {
    switch (activeTab.value) {
        case 'content':
            fetchResources();
            fetchSubjects();
            break;
        case 'code':
            fetchCodes();
            break;
        case 'feedback':
            fetchFeedbacks();
            break;
        case 'collections':
            fetchCollections();
            break;
    }
};

// 监听标签页变化，切换时立即刷新
watch(activeTab, (newTab) => {
    refreshCurrentTab();
});

// 删除兑换码
const deleteCode = async (code) => {
    try {
        await ElMessageBox.confirm(
            `确定要删除兑换码 "${code.code}" 吗？`,
            '确认删除',
            {
                confirmButtonText: '删除',
                cancelButtonText: '取消',
                type: 'warning',
            }
        );
        await adminVideoApi.deleteCode(code.id);
        // 从本地列表中移除
        const index = codes.value.findIndex(c => c.id === code.id);
        if (index !== -1) {
            codes.value.splice(index, 1);
        }
        ElMessage.success('删除成功');
    } catch (e) {
        if (e !== 'cancel') {
            ElMessage.error(e.message || '删除失败');
        }
    }
};

onMounted(() => {
    fetchSubjects();
    fetchCodes();
    fetchFeedbacks();
    fetchCollections();
});

// Batch Import Functions
const openBatchImportModal = () => {
    batchImportData.value = {
        collectionName: '',
        subjectId: null,
        categoryId: null,
        importType: 'file',
        jsonContent: '',
        requiresRedemption: 1,
        isPublic: 1
    };
    importPreview.value = [];
    selectedFile.value = null;
    showBatchImportModal.value = true;
};

const getCategoriesBySubject = (subjectId) => {
    if (!subjectId) return [];
    const subject = subjects.value.find(s => s.id === subjectId);
    return subject ? subject.categories : [];
};

const handleFileChange = (file) => {
    selectedFile.value = file.raw;
};

const previewImport = async () => {
    try {
        let jsonData = null;
        
        if (batchImportData.value.importType === 'file') {
            if (!selectedFile.value) {
                ElMessage.warning('请选择JSON文件');
                return;
            }
            const text = await selectedFile.value.text();
            jsonData = JSON.parse(text);
        } else {
            if (!batchImportData.value.jsonContent.trim()) {
                ElMessage.warning('请粘贴JSON内容');
                return;
            }
            jsonData = JSON.parse(batchImportData.value.jsonContent);
        }
        
        // 解析视频列表
        const videoList = jsonData.data?.list || jsonData.list || [];
        if (videoList.length === 0) {
            ElMessage.warning('未找到视频数据');
            return;
        }
        
        importPreview.value = videoList.map(item => ({
            title: item.lessonName || item.title || '未命名',
            url: item.lessonUrl || item.url || ''
        })).filter(item => item.url);
        
        if (importPreview.value.length === 0) {
            ElMessage.warning('未找到有效的视频链接');
            return;
        }
        
        ElMessage.success(`成功解析 ${importPreview.value.length} 个视频`);
    } catch (e) {
        ElMessage.error('JSON解析失败：' + e.message);
    }
};

const confirmBatchImport = async () => {
    try {
        if (!batchImportData.value.collectionName) {
            ElMessage.warning('请输入集合名称');
            return;
        }
        if (!batchImportData.value.subjectId) {
            ElMessage.warning('请选择科目');
            return;
        }
        if (importPreview.value.length === 0) {
            ElMessage.warning('没有可导入的视频');
            return;
        }
        
        const res = await adminVideoApi.batchImportVideos({
            collectionName: batchImportData.value.collectionName,
            subjectId: batchImportData.value.subjectId,
            categoryId: batchImportData.value.categoryId,
            videos: importPreview.value,
            requiresRedemption: batchImportData.value.requiresRedemption,
            isPublic: batchImportData.value.isPublic
        });
        
        if (res.code === 0) {
            ElMessage.success(`成功导入 ${importPreview.value.length} 个视频`);
            showBatchImportModal.value = false;
            fetchResources();
        }
    } catch (e) {
        ElMessage.error('导入失败：' + (e.message || '未知错误'));
    }
};

</script>

<style scoped>
.video-admin {
  padding: 20px;
}
.header { margin-bottom: 20px; }
.manage-layout {
  display: flex;
  height: calc(100vh - 250px);
  border: 1px solid #eee;
}
.manage-sidebar {
  width: 250px;
  border-right: 1px solid #eee;
  overflow-y: auto;
}
.sidebar-header {
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  background-color: #f5f7fa;
}
.manage-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: nowrap;
}

.table-wrapper {
  overflow-x: auto;
  width: 100%;
}

.action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
}

.action-buttons .el-button {
  margin: 0;
}
.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
}
.tree-actions {
  display: none;
  gap: 2px;
  position: relative;
  z-index: 10;
  background: #fff;
  padding: 2px 4px;
  border-radius: 4px;
}
.custom-tree-node:hover .tree-actions {
  display: flex;
}
.tree-actions .el-button {
  padding: 2px 6px;
  font-size: 12px;
  margin-left: 0;
}
/* 确保 el-sub-menu 的箭头不会遮挡操作按钮 */
:deep(.el-sub-menu__title) {
  position: relative;
}
:deep(.el-sub-menu__icon-arrow) {
  position: absolute;
  right: 8px;
  z-index: 1;
}
.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.video-items-section {
  margin-top: 20px;
  border-top: 1px solid #eee;
  padding-top: 10px;
}
.video-item-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}
.idx { width: 20px; }
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  color: #909399;
}

/* Collection Videos Manager Styles */
.collection-videos-manager .collection-layout {
  display: flex;
  gap: 20px;
  height: 500px;
}

.collection-videos-manager .available-videos,
.collection-videos-manager .selected-videos {
  flex: 1;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.collection-videos-manager .panel-header {
  padding: 12px 16px;
  background-color: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 500;
  color: #303133;
}

.collection-videos-manager .search-input {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
}

.collection-videos-manager .subject-collapse {
  flex: 1;
  overflow-y: auto;
}

.collection-videos-manager .subject-collapse :deep(.el-collapse-item__header) {
  padding: 0 16px;
  font-weight: 500;
  color: #409EFF;
  background-color: #ecf5ff;
}

.collection-videos-manager .subject-collapse :deep(.el-collapse-item__content) {
  padding: 8px 16px;
}

.collection-videos-manager .video-checkbox-group {
  display: flex;
  flex-direction: column;
}

.collection-videos-manager .video-checkbox {
  margin: 4px 0;
  height: auto;
  min-height: 32px;
  white-space: normal;
  word-break: break-all;
  line-height: 1.4;
}

.collection-videos-manager .video-checkbox :deep(.el-checkbox__label) {
  white-space: normal;
  word-break: break-all;
  line-height: 1.4;
}

.collection-videos-manager .selected-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.collection-videos-manager .selected-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
}

.collection-videos-manager .selected-item:last-child {
  border-bottom: none;
}

.collection-videos-manager .selected-title {
  flex: 1;
  word-break: break-all;
  line-height: 1.4;
  padding-right: 8px;
}
</style>
